import type { Point, BrushType } from "./types";

// How far each brush's actual visible ink can land from the stroke's path,
// as a multiple of `width / 2` — some brushes (lib/brushes.ts) scatter dots,
// blooms, or glow well outside the raw line width for a painterly/textured
// look. A plain `width / 2` tolerance only matches brushes whose ink hugs
// the path (brush, pencil, calligraphy), so hovering the actual visible
// pixels of the others frequently missed. Derived from each renderer's
// geometry (spread/dotScale/offset terms), rounded up for safety — an
// oversized hit zone is an imperceptible trade-off, a missed one isn't.
const BRUSH_HIT_RADIUS_MULTIPLIER: Record<BrushType, number> = {
  brush: 1,
  pencil: 1,
  marker: 1.3,
  highlighter: 2,
  calligraphy: 1,
  pixel: 1.5,
  watercolor: 2.2,
  oilPaint: 1.3,
  chalk: 2.2,
  charcoal: 2.2,
  glitter: 2.5,
  neonGlow: 1.5,
  halftone: 1.5,
};
const DEFAULT_HIT_RADIUS_MULTIPLIER = 1;

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
  /** Only meaningful when mode === "draw" — see BRUSH_HIT_RADIUS_MULTIPLIER. */
  brushType?: BrushType;
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
    const multiplier = stroke.brushType
      ? (BRUSH_HIT_RADIUS_MULTIPLIER[stroke.brushType] ?? DEFAULT_HIT_RADIUS_MULTIPLIER)
      : DEFAULT_HIT_RADIUS_MULTIPLIER;
    if (distanceToPolyline(point, stroke.points) <= (stroke.width / 2) * multiplier + extraRadius) {
      return stroke;
    }
  }
  return null;
}
