import { describe, it, expect } from "vitest";
import { calculateSymmetricPoints } from "./symmetry";

describe("lib/symmetry", () => {
  it("returns single point when symmetry is off", () => {
    const pt = { x: 100, y: 200 };
    expect(calculateSymmetricPoints(pt, "off")).toEqual([pt]);
  });

  it("calculates 2-way horizontal mirror points", () => {
    const pt = { x: 10200, y: 10100 };
    const center = { x: 10000, y: 10000 };
    const pts = calculateSymmetricPoints(pt, "mirror2", center);

    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual(pt);
    expect(pts[1]).toEqual({ x: 9800, y: 10100 });
  });

  it("calculates 4-way quadrant mirror points", () => {
    const pt = { x: 10100, y: 10100 };
    const center = { x: 10000, y: 10000 };
    const pts = calculateSymmetricPoints(pt, "mirror4", center);

    expect(pts).toHaveLength(4);
  });

  it("calculates 8-way mandala radial points", () => {
    const pt = { x: 10100, y: 10000 };
    const center = { x: 10000, y: 10000 };
    const pts = calculateSymmetricPoints(pt, "mandala8", center);

    expect(pts).toHaveLength(8);
  });
});
