import { describe, it, expect } from "vitest";
import { floodFillMask } from "./floodFill";

function makeImageData(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const [r, g, b, a] = paint(x, y);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

describe("real seed-fill (lib/floodFill.ts)", () => {
  it("fills a solid-color region and stops at a differently-colored boundary", () => {
    // 10x10 white square with a black 1px border — fill from the center
    // should only ever touch interior white pixels, never the border.
    const img = makeImageData(10, 10, (x, y) => {
      const isBorder = x === 0 || y === 0 || x === 9 || y === 9;
      return isBorder ? [0, 0, 0, 255] : [255, 255, 255, 255];
    });
    const filled = floodFillMask(img, 5, 5, { step: 1 });
    expect(filled.length).toBeGreaterThan(0);
    for (const p of filled) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(9);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(9);
    }
  });

  it("does not leak through a solid boundary into a disconnected same-color region", () => {
    // Two 3x3 white squares separated by a black column — filling one must
    // not touch the other.
    const img = makeImageData(9, 3, (x) => (x === 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const filled = floodFillMask(img, 1, 1, { step: 1 });
    expect(filled.every((p) => p.x < 4)).toBe(true);
  });

  it("returns nothing for an out-of-bounds start point", () => {
    const img = makeImageData(5, 5, () => [255, 255, 255, 255]);
    expect(floodFillMask(img, -1, 2)).toEqual([]);
    expect(floodFillMask(img, 10, 2)).toEqual([]);
  });

  it("respects the step grid, not returning every single visited pixel", () => {
    const img = makeImageData(20, 20, () => [10, 10, 10, 255]);
    const filled = floodFillMask(img, 10, 10, { step: 5 });
    expect(filled.length).toBeLessThan(20 * 20);
    for (const p of filled) {
      expect(p.x % 5).toBe(0);
      expect(p.y % 5).toBe(0);
    }
  });
});
