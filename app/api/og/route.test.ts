import { describe, it, expect } from "vitest";
import { GET } from "./route";

function req(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/og");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

describe("GET /api/og", () => {
  it("returns an SVG with the right content type and long-lived cache headers", async () => {
    const res = await GET(req());
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(res.headers.get("Cache-Control")).toContain("max-age=86400");
    const body = await res.text();
    expect(body.startsWith("<svg")).toBe(true);
  });

  it("falls back to sensible defaults when no query params are given", async () => {
    const body = await (await GET(req())).text();
    // The apostrophe in the default title goes through the same escaping as
    // user-supplied ones, since rawTitle's fallback and query-param cases
    // share one code path.
    expect(body).toContain("The World&apos;s Shared Real-Time Canvas");
    expect(body).toContain("X=0, Y=0");
    expect(body).toContain("LIVE CANVAS");
  });

  it("interpolates title, x, y, and mode from query params", async () => {
    const body = await (await GET(req({ title: "Custom Title", x: "42", y: "-7", mode: "Sketchbook" }))).text();
    expect(body).toContain("Custom Title");
    expect(body).toContain("X=42, Y=-7");
    expect(body).toContain("SKETCHBOOK");
  });

  it("escapes XML-significant characters in the title so untrusted input can't break the SVG", async () => {
    const body = await (await GET(req({ title: `<script>&"'</script>` }))).text();
    expect(body).not.toContain("<script>");
    expect(body).toContain("&lt;script&gt;&amp;&quot;&apos;&lt;/script&gt;");
  });
});
