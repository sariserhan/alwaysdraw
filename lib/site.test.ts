import { describe, expect, it } from "vitest";
import { SKETCHBOOK_PAGES } from "./sketchbookPages";
import { SITE_URL, absoluteUrl, indexablePaths, pageMetadata } from "./site";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";

describe("site URLs", () => {
  it("defaults to the apex production host", () => {
    expect(SITE_URL).toBe("https://alwaysdraw.com");
  });

  it("builds absolute URLs on the canonical host", () => {
    expect(absoluteUrl("/")).toBe("https://alwaysdraw.com");
    expect(absoluteUrl("/canvas")).toBe("https://alwaysdraw.com/canvas");
    expect(absoluteUrl("sketchbook/chess")).toBe("https://alwaysdraw.com/sketchbook/chess");
  });

  it("gives each page a self-referencing canonical and og:url", () => {
    const meta = pageMetadata({ path: "/sketchbook/chess", title: "Chess", description: "d" });
    expect(meta.alternates?.canonical).toBe("https://alwaysdraw.com/sketchbook/chess");
    expect((meta.openGraph as { url?: string } | undefined)?.url).toBe("https://alwaysdraw.com/sketchbook/chess");
  });
});

describe("sitemap", () => {
  const entries = sitemap();

  it("lists every public route, each sketchbook page included, on the apex host", () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://alwaysdraw.com");
    expect(urls).toContain("https://alwaysdraw.com/canvas");
    expect(urls).toContain("https://alwaysdraw.com/board");
    expect(urls).toContain("https://alwaysdraw.com/sketchbook");
    for (const id of Object.keys(SKETCHBOOK_PAGES)) {
      expect(urls).toContain(`https://alwaysdraw.com/sketchbook/${id}`);
    }
    expect(urls).toHaveLength(indexablePaths().length);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(url.startsWith("https://alwaysdraw.com")).toBe(true);
  });

  it("never claims a lastmod it does not know", () => {
    for (const e of entries) expect(e.lastModified).toBeUndefined();
  });

  it("only lists ids that resolve to a real sketchbook page", () => {
    for (const id of Object.keys(SKETCHBOOK_PAGES)) expect(SKETCHBOOK_PAGES[id]?.id).toBe(id);
  });
});

describe("robots.txt", () => {
  it("leaves /_next/ crawlable so Googlebot can render client-drawn pages", () => {
    const rules = [robots().rules].flat();
    const disallow = rules.flatMap((r) => [r.disallow ?? []].flat());
    expect(disallow).not.toContain("/_next/");
    expect(robots().sitemap).toBe("https://alwaysdraw.com/sitemap.xml");
  });
});
