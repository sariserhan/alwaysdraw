import { describe, it, expect, vi, afterEach } from "vitest";
import { GET, POST } from "./route";

function postReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/ai-draw", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// The rate limiter (requestLog) is a module-level Map keyed by the request's
// client-IP header — give each test a distinct fake IP so they don't
// interfere with each other's budget.
let ipCounter = 0;
function freshIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

describe("GET /api/ai-draw — status", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports the procedural engine when no Gemini key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_GEMINI_API_KEY", "");
    const res = await GET();
    const body = await res.json();
    expect(body.hasApiKey).toBe(false);
    expect(body.engine).toBe("procedural");
  });

  it("reports the Gemini engine when a key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const res = await GET();
    const body = await res.json();
    expect(body.hasApiKey).toBe(true);
    expect(body.engine).toBe("gemini-flash-latest");
  });
});

describe("POST /api/ai-draw", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("falls back to procedural generation when no API key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_GEMINI_API_KEY", "");
    const res = await POST(postReq({ prompt: "a tree" }, { "cf-connecting-ip": freshIp() }));
    const body = await res.json();
    expect(body.source).toBe("procedural");
    expect(Array.isArray(body.strokes)).toBe(true);
    expect(body.strokes.length).toBeGreaterThan(0);
  });

  it("tolerates a malformed JSON body and still returns a procedural fallback", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(
      new Request("http://localhost/api/ai-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": freshIp() },
        body: "{not valid json",
      }),
    );
    const body = await res.json();
    expect(body.source).toBe("procedural");
  });

  it("parses a successful Gemini response into strokes", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const geminiPayload = {
      strokes: [
        { points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: "#39c07a", width: 6, brushType: "brush" },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiPayload) }] } }] })),
    );
    const res = await POST(postReq({ prompt: "a cat" }, { "cf-connecting-ip": freshIp() }));
    const body = await res.json();
    expect(body.source).toBe("gemini-flash-latest");
    expect(body.strokes).toEqual([
      { points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], color: "#39c07a", brushType: "brush", width: 6, opacity: 1 },
    ]);
  });

  it("falls back to procedural generation when Gemini returns a non-OK response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("server error", { status: 500 })),
    );
    const res = await POST(postReq({ prompt: "a dog" }, { "cf-connecting-ip": freshIp() }));
    const body = await res.json();
    expect(body.source).toBe("procedural-fallback");
  });

  it("falls back to procedural generation when Gemini's response has no candidate text", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ candidates: [] })),
    );
    const res = await POST(postReq({ prompt: "a bird" }, { "cf-connecting-ip": freshIp() }));
    const body = await res.json();
    expect(body.source).toBe("procedural-fallback");
  });

  it("falls back to procedural generation when Gemini returns zero strokes", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ strokes: [] }) }] } }] }),
      ),
    );
    const res = await POST(postReq({ prompt: "nothing" }, { "cf-connecting-ip": freshIp() }));
    const body = await res.json();
    expect(body.source).toBe("procedural-fallback");
  });

  it("falls back to procedural generation when the Gemini call throws", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const res = await POST(postReq({ prompt: "a fish" }, { "cf-connecting-ip": freshIp() }));
    const body = await res.json();
    expect(body.source).toBe("procedural-error-fallback");
  });

  it("rate limits a single IP to 5 Gemini requests per minute, without ever calling fetch on the 6th", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ strokes: [] }) }] } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const ip = freshIp();

    for (let i = 0; i < 5; i++) {
      const res = await POST(postReq({ prompt: `attempt ${i}` }, { "cf-connecting-ip": ip }));
      expect((await res.json()).source).not.toBe("rate-limited");
    }
    expect(fetchMock).toHaveBeenCalledTimes(5);

    const limited = await POST(postReq({ prompt: "one too many" }, { "cf-connecting-ip": ip }));
    const body = await limited.json();
    expect(body.source).toBe("rate-limited");
    expect(fetchMock).toHaveBeenCalledTimes(5); // still 5 — the 6th never reached Gemini
  });
});
