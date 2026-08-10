import { describe, it, expect } from "vitest";
import { findStrokeNearPoint } from "./hitTest";

describe("stroke hit-testing (lib/hitTest.ts)", () => {
  it("finds a stroke whose line passes within range of the point", () => {
    const strokes = [
      { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], width: 4, mode: "draw" as const },
    ];
    expect(findStrokeNearPoint(strokes, { x: 50, y: 3 }, 2)).toBe(strokes[0]);
    expect(findStrokeNearPoint(strokes, { x: 50, y: 30 }, 2)).toBeNull();
  });

  it("prefers the most recently drawn stroke when several overlap", () => {
    const older = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 2, mode: "draw" as const };
    const newer = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 2, mode: "draw" as const };
    expect(findStrokeNearPoint([older, newer], { x: 5, y: 0 }, 1)).toBe(newer);
  });

  it("skips erase strokes — nothing visible to attribute a click to", () => {
    const strokes = [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], width: 4, mode: "erase" as const }];
    expect(findStrokeNearPoint(strokes, { x: 5, y: 0 }, 1)).toBeNull();
  });

  it("handles a single-point stroke as a point, not a degenerate line", () => {
    const strokes = [{ points: [{ x: 5, y: 5 }], width: 4, mode: "draw" as const }];
    expect(findStrokeNearPoint(strokes, { x: 5, y: 6 }, 1)).toBe(strokes[0]);
    expect(findStrokeNearPoint(strokes, { x: 5, y: 20 }, 1)).toBeNull();
  });
});
