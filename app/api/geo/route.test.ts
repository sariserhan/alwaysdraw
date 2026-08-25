import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "./route";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/geo", { headers });
}

describe("GET /api/geo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers Cloudflare's cf-ipcountry header", async () => {
    const res = await GET(req({ "cf-ipcountry": "de" }));
    expect(await res.json()).toEqual({ countryCode: "DE" });
  });

  it("falls back to Vercel's x-vercel-ip-country header", async () => {
    const res = await GET(req({ "x-vercel-ip-country": "fr" }));
    expect(await res.json()).toEqual({ countryCode: "FR" });
  });

  it("treats CDN 'no country resolved' sentinels as null, not a real code", async () => {
    const res = await GET(req({ "cf-ipcountry": "XX" }));
    expect(await res.json()).toEqual({ countryCode: null });
  });

  it("returns null with no headers and no forwarded IP", async () => {
    const res = await GET(req());
    expect(await res.json()).toEqual({ countryCode: null });
  });

  it("falls back to a geo-IP lookup keyed on x-forwarded-for when no CDN header is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("JP")),
    );
    const res = await GET(req({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }));
    expect(await res.json()).toEqual({ countryCode: "JP" });
  });

  it("returns null when the geo-IP lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    const res = await GET(req({ "x-forwarded-for": "203.0.113.5" }));
    expect(await res.json()).toEqual({ countryCode: null });
  });

  it("returns null when the geo-IP lookup throws (e.g. times out)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    const res = await GET(req({ "x-forwarded-for": "203.0.113.5" }));
    expect(await res.json()).toEqual({ countryCode: null });
  });

  it("never sends the resolved IP itself back in the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("US")),
    );
    const res = await GET(req({ "x-forwarded-for": "203.0.113.5" }));
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("203.0.113.5");
  });
});
