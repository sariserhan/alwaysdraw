import type { Point } from "./types";

export type SketchbookRegion = { id: string; points: Point[] };

export type SketchbookPage = {
  id: string;
  title: string;
  width: number;
  height: number;
  regions: SketchbookRegion[];
  // When set, this image (a static file under public/) renders as the
  // page's visible artwork instead of region-derived outline paths — see
  // SketchbookCanvas.tsx. Pairs with a single full-canvas rectangle
  // region below so painting is unrestricted (free-form) rather than
  // clipped to hand-picked shapes; the region machinery itself is
  // unchanged, "one region covering everything" just means "paint
  // anywhere."
  imageUrl?: string;
};

/** One region spanning the entire page — for free-form (imageUrl) pages,
 * where painting is meant to be unrestricted rather than clipped to
 * hand-picked shapes. See the `imageUrl` doc comment on SketchbookPage. */
function fullCanvasRegion(width: number, height: number): SketchbookRegion {
  return {
    id: "canvas",
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
  };
}

// Every consumer (server validation, SVG render, canvas clip, hit test)
// reads only this registry, so adding real outline art later only means
// adding another entry here.
export const SKETCHBOOK_PAGES: Record<string, SketchbookPage | undefined> = {
  // Free-form pages below: each width/height matches its SVG's own
  // viewBox exactly (native scale, no coordinate conversion), and each
  // has exactly one fullCanvasRegion — see the imageUrl doc comment.
  geisha: {
    id: "geisha",
    title: "Geisha",
    width: 159.007,
    height: 476.917,
    regions: [fullCanvasRegion(159.007, 476.917)],
    imageUrl: "/sketchbook/geisha.svg",
  },
  chess: {
    id: "chess",
    title: "Chess",
    width: 468.75,
    height: 606.61686,
    regions: [fullCanvasRegion(468.75, 606.61686)],
    imageUrl: "/sketchbook/chess.svg",
  },
  pinup: {
    id: "pinup",
    title: "Pinup",
    width: 848,
    height: 1312,
    regions: [fullCanvasRegion(848, 1312)],
    imageUrl: "/sketchbook/pinup.svg",
  },
  flourish: {
    id: "flourish",
    title: "Flourish",
    width: 2409,
    height: 3437,
    regions: [fullCanvasRegion(2409, 3437)],
    imageUrl: "/sketchbook/flourish.svg",
  },
  flowerframe: {
    id: "flowerframe",
    title: "Flower Frame",
    width: 516.73914,
    height: 729.5885,
    regions: [fullCanvasRegion(516.73914, 729.5885)],
    imageUrl: "/sketchbook/flowerframe.svg",
  },
  mathematician: {
    id: "mathematician",
    title: "Mathematician",
    width: 286.278,
    height: 259.312,
    regions: [fullCanvasRegion(286.278, 259.312)],
    imageUrl: "/sketchbook/mathematician.svg",
  },
  spacewalk: {
    id: "spacewalk",
    title: "Spacewalk",
    width: 614,
    height: 622.072,
    regions: [fullCanvasRegion(614, 622.072)],
    imageUrl: "/sketchbook/spacewalk.svg",
  },
  "classic-car": {
    id: "classic-car",
    title: "Classic Car",
    width: 947,
    height: 576,
    regions: [fullCanvasRegion(947, 576)],
    imageUrl: "/sketchbook/classic-car.svg",
  },
  "bomber-plane": {
    id: "bomber-plane",
    title: "Bomber Plane",
    width: 1135.7,
    height: 867.28,
    regions: [fullCanvasRegion(1135.7, 867.28)],
    imageUrl: "/sketchbook/bomber-plane.svg",
  },
  tortoise: {
    id: "tortoise",
    title: "Tortoise",
    width: 468,
    height: 263,
    regions: [fullCanvasRegion(468, 263)],
    imageUrl: "/sketchbook/tortoise.svg",
  },
  mandala: {
    id: "mandala",
    title: "Mandala",
    width: 3295,
    height: 3294,
    regions: [fullCanvasRegion(3295, 3294)],
    imageUrl: "/sketchbook/mandala.svg",
  },
  "lineart-mural": {
    id: "lineart-mural",
    title: "Mural",
    width: 2637.1,
    height: 887.5,
    regions: [fullCanvasRegion(2637.1, 887.5)],
    imageUrl: "/sketchbook/lineart-mural.svg",
  },
};

// Legacy sketchbookStrokes rows written before multi-page support have no
// pageId — the one-time backfill migration (convex/migrations.ts) assigns
// them here. "flower" was the only page that existed at the time and has
// since been removed from the registry above; this stays a historical
// label for those old rows rather than a real, resolvable page id.
export const DEFAULT_SKETCHBOOK_PAGE_ID = "flower";

/** The only sound way to check a pageId: `in` and plain truthy lookups on
 * SKETCHBOOK_PAGES both pass for inherited Object.prototype keys like
 * "constructor" or "__proto__", which are not real pages. Object.hasOwn
 * rules those out. Every validating call site must go through this. */
export function getSketchbookPage(pageId: string): SketchbookPage | undefined {
  return Object.hasOwn(SKETCHBOOK_PAGES, pageId) ? SKETCHBOOK_PAGES[pageId] : undefined;
}

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
