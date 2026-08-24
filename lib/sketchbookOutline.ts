import type { Point } from "./types";

export type SketchbookRegion = { id: string; points: Point[] };

export const SKETCHBOOK_PAGE_WIDTH = 800;
export const SKETCHBOOK_PAGE_HEIGHT = 1000;

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number, sides = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

// v1 placeholder art: a simple 5-petal flower with a stem and two leaves.
// Every consumer (server validation, SVG render, canvas clip, hit test)
// reads only this array, so swapping in real outline art later only
// means editing this one list.
export const SKETCHBOOK_REGIONS: SketchbookRegion[] = [
  { id: "center", points: ellipsePolygon(400, 400, 50, 50) },
  { id: "petal-1", points: ellipsePolygon(400, 285, 55, 55) },
  { id: "petal-2", points: ellipsePolygon(509.4, 364.5, 55, 55) },
  { id: "petal-3", points: ellipsePolygon(467.6, 493, 55, 55) },
  { id: "petal-4", points: ellipsePolygon(332.4, 493, 55, 55) },
  { id: "petal-5", points: ellipsePolygon(290.6, 364.5, 55, 55) },
  {
    id: "stem",
    points: [
      { x: 390, y: 450 },
      { x: 410, y: 450 },
      { x: 410, y: 850 },
      { x: 390, y: 850 },
    ],
  },
  { id: "leaf-left", points: ellipsePolygon(330, 650, 50, 25) },
  { id: "leaf-right", points: ellipsePolygon(470, 650, 50, 25) },
];

/** Ray-casting point-in-polygon test — pure arithmetic, no DOM/canvas APIs,
 * so it runs identically in the browser and in Convex's server runtime. */
export function isPointInRegion(region: SketchbookRegion, x: number, y: number): boolean {
  const pts = region.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** First region (in array order) containing (x, y), or null if none does. */
export function findRegionAt(regions: SketchbookRegion[], x: number, y: number): SketchbookRegion | null {
  for (const region of regions) {
    if (isPointInRegion(region, x, y)) return region;
  }
  return null;
}

/** SVG/Path2D path-data string for a region's polygon, for `<path d=...>`
 * or `new Path2D(...)` — both browser-only call sites, never used here. */
export function regionPathData(region: SketchbookRegion): string {
  const [first, ...rest] = region.points;
  return `M ${first.x},${first.y} ${rest.map((p) => `L ${p.x},${p.y}`).join(" ")} Z`;
}
