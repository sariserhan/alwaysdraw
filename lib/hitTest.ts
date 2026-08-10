import type { Point } from "./types";

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPolyline(p: Point, points: Point[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y);
  let min = Infinity;
  for (let i = 1; i < points.length; i++) {
    const d = distanceToSegment(p, points[i - 1], points[i]);
    if (d < min) min = d;
  }
  return min;
}

export interface HitTestableStroke {
  points: Point[];
  width: number;
  mode: "draw" | "erase";
}

/**
 * Finds the topmost (most-recently-drawn) stroke whose rendered line passes
 * within `extraRadius` of `point`, in world units. Iterates newest-first so
 * the pick matches visual z-order (later strokes paint over earlier ones).
 * Erase strokes are skipped — there's no visible mark to attribute a click
 * on empty canvas to.
 */
export function findStrokeNearPoint<T extends HitTestableStroke>(
  strokes: T[],
  point: Point,
  extraRadius: number,
): T | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i];
    if (stroke.mode === "erase") continue;
    if (distanceToPolyline(point, stroke.points) <= stroke.width / 2 + extraRadius) {
      return stroke;
    }
  }
  return null;
}
