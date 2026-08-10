import type { Point, WorldRect } from "./types";
import type { Camera } from "./camera";
import { clampZoom } from "./camera";

export function normalizeRect(a: Point, b: Point): WorldRect {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

/** True if any point of a stroke falls inside the region — cheap and good
 * enough for scoping a replay/export selection (a stroke that merely brushes
 * the edge without any recorded point inside it is a rare enough miss that
 * it's not worth a full segment-vs-rect intersection test here). */
export function strokeIntersectsRegion(points: Point[], region: WorldRect): boolean {
  for (const p of points) {
    if (p.x >= region.minX && p.x <= region.maxX && p.y >= region.minY && p.y <= region.maxY) {
      return true;
    }
  }
  return false;
}

/** Camera that centers on and fits `region` within a viewport, with padding
 * so the selection isn't flush against the edges. */
export function fitCameraToRegion(
  region: WorldRect,
  viewportWidth: number,
  viewportHeight: number,
  padding = 0.85,
): Camera {
  const regionWidth = Math.max(1, region.maxX - region.minX);
  const regionHeight = Math.max(1, region.maxY - region.minY);
  const zoomX = (viewportWidth * padding) / regionWidth;
  const zoomY = (viewportHeight * padding) / regionHeight;
  return {
    x: (region.minX + region.maxX) / 2,
    y: (region.minY + region.maxY) / 2,
    zoom: clampZoom(Math.min(zoomX, zoomY)),
  };
}
