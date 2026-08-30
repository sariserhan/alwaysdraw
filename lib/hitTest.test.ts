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

  it("widens the hit radius for brush types whose visible ink extends past the raw line width", () => {
    // glitter/chalk/watercolor etc. scatter dots and blooms well outside
    // `width/2` for their painterly look (see lib/brushes.ts) — a plain
    // brush/pencil stroke's ink stays tight to the path, so the same
    // distance from the line should hit one and miss the other.
    const glitterStroke = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      width: 10,
      mode: "draw" as const,
      brushType: "glitter" as const,
    };
    const brushStroke = {
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      width: 10,
      mode: "draw" as const,
      brushType: "brush" as const,
    };
    // 9 world units off the line: outside a plain brush's width/2 (5) plus
    // a small extraRadius (1)...
    expect(findStrokeNearPoint([brushStroke], { x: 50, y: 9 }, 1)).toBeNull();
    // ...but within glitter's actual scattered-sparkle reach.
    expect(findStrokeNearPoint([glitterStroke], { x: 50, y: 9 }, 1)).toBe(glitterStroke);
  });

  it("treats an undeclared brushType the same as the default brush (no widening)", () => {
    const strokes = [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], width: 10, mode: "draw" as const }];
    expect(findStrokeNearPoint(strokes, { x: 50, y: 9 }, 1)).toBeNull();
  });
});
