import { describe, it, expect } from "vitest";
import { normalizeRect, strokeIntersectsRegion, fitCameraToRegion } from "./regionFilter";

describe("region selection (lib/regionFilter.ts)", () => {
  it("normalizes a drag rect regardless of drag direction", () => {
    expect(normalizeRect({ x: 100, y: 200 }, { x: 50, y: 20 })).toEqual({
      minX: 50,
      minY: 20,
      maxX: 100,
      maxY: 200,
    });
  });

  it("finds strokes with a point inside the region", () => {
    const region = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(strokeIntersectsRegion([{ x: 50, y: 50 }], region)).toBe(true);
    expect(strokeIntersectsRegion([{ x: 500, y: 500 }], region)).toBe(false);
    expect(strokeIntersectsRegion([{ x: 500, y: 500 }, { x: 10, y: 10 }], region)).toBe(true);
  });

  it("fits a camera centered on the region within the viewport", () => {
    const region = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    const camera = fitCameraToRegion(region, 1000, 1000);
    expect(camera.x).toBe(100);
    expect(camera.y).toBe(50);
    expect(camera.zoom).toBeGreaterThan(0);
  });
});
