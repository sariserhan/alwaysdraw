import { describe, it, expect } from "vitest";
import { SKETCHBOOK_REGIONS, findRegionAt, isPointInRegion, regionPathData } from "./sketchbookOutline";

describe("sketchbookOutline region hit-testing", () => {
  it("resolves a point inside the center region to 'center'", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 400, 400)?.id).toBe("center");
  });

  it("resolves a point inside petal-1 to 'petal-1'", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 400, 285)?.id).toBe("petal-1");
  });

  it("resolves a point inside the stem to 'stem'", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 400, 700)?.id).toBe("stem");
  });

  it("resolves points inside each leaf to their own region", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 330, 650)?.id).toBe("leaf-left");
    expect(findRegionAt(SKETCHBOOK_REGIONS, 470, 650)?.id).toBe("leaf-right");
  });

  it("returns null for a point outside every region", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 50, 50)).toBeNull();
    expect(findRegionAt(SKETCHBOOK_REGIONS, 700, 900)).toBeNull();
  });

  it("region ids are unique", () => {
    const ids = SKETCHBOOK_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds well-formed SVG/Path2D path data for every region", () => {
    for (const region of SKETCHBOOK_REGIONS) {
      const d = regionPathData(region);
      expect(d.startsWith("M ")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
    }
  });

  it("isPointInRegion agrees with findRegionAt for a known-inside point", () => {
    const center = SKETCHBOOK_REGIONS.find((r) => r.id === "center")!;
    expect(isPointInRegion(center, 400, 400)).toBe(true);
  });
});
