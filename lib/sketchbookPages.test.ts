import { describe, it, expect } from "vitest";
import { SKETCHBOOK_PAGES, findRegionAt, isPointInRegion, regionPathData, type SketchbookPage } from "./sketchbookPages";

describe("sketchbookPages region hit-testing — flower", () => {
  const regions = SKETCHBOOK_PAGES.flower!.regions;

  it("resolves a point inside the center region to 'center'", () => {
    expect(findRegionAt(regions, 400, 400)?.id).toBe("center");
  });

  it("resolves a point inside petal-1 to 'petal-1'", () => {
    expect(findRegionAt(regions, 400, 285)?.id).toBe("petal-1");
  });

  it("resolves a point inside the stem to 'stem'", () => {
    expect(findRegionAt(regions, 400, 700)?.id).toBe("stem");
  });

  it("resolves points inside each leaf to their own region", () => {
    expect(findRegionAt(regions, 330, 650)?.id).toBe("leaf-left");
    expect(findRegionAt(regions, 470, 650)?.id).toBe("leaf-right");
  });

  it("returns null for a point outside every region", () => {
    expect(findRegionAt(regions, 50, 50)).toBeNull();
    expect(findRegionAt(regions, 700, 900)).toBeNull();
  });
});

describe("sketchbookPages region hit-testing — circle", () => {
  const regions = SKETCHBOOK_PAGES.circle!.regions;

  it("resolves the page center to 'circle'", () => {
    expect(findRegionAt(regions, 200, 200)?.id).toBe("circle");
  });

  it("returns null for a point outside the circle", () => {
    expect(findRegionAt(regions, 10, 10)).toBeNull();
  });
});

describe("sketchbookPages registry invariants", () => {
  const allPages = Object.values(SKETCHBOOK_PAGES).filter((p): p is SketchbookPage => p !== undefined);

  it("every page has unique region ids within that page", () => {
    for (const page of allPages) {
      const ids = page.regions.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("builds well-formed SVG/Path2D path data for every region on every page", () => {
    for (const page of allPages) {
      for (const region of page.regions) {
        const d = regionPathData(region);
        expect(d.startsWith("M ")).toBe(true);
        expect(d.endsWith("Z")).toBe(true);
      }
    }
  });

  it("isPointInRegion agrees with findRegionAt for a known-inside point", () => {
    const center = SKETCHBOOK_PAGES.flower!.regions.find((r) => r.id === "center")!;
    expect(isPointInRegion(center, 400, 400)).toBe(true);
  });
});
