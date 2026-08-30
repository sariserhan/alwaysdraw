import type { Tool } from "./types";
import { DEFAULT_ZOOM } from "./camera";

/** Tools that leave a permanent mark on the shared canvas — gated behind a
 * minimum zoom level on canvases that support zoom/pan, so new users don't
 * default to painting across the entire infinite wall before realizing they
 * can zoom into an area and add detail there. Navigation/utility tools
 * (pan, magnifier, eyedropper, laser, comment, region selection, admin
 * tools) are exempt — they don't clutter the shared canvas. */
export const ZOOM_GATED_TOOLS: ReadonlySet<Tool> = new Set<Tool>([
  "brush",
  "eraser",
  "shape",
  "ruler",
  "stencil",
  "text",
]);

// The wall loads at DEFAULT_ZOOM, which shows the entire 20,000x20,000 world
// at once — exactly why new users default to painting at that scale. 4x as
// a first cut; tune from real usage once this ships.
export const TOOL_ZOOM_GATE_THRESHOLD = DEFAULT_ZOOM * 4;

/** Board's camera is fixed (supportsZoomPan is false there), so gating is
 * meaningless — Board is already small enough that "zoom into an area"
 * doesn't apply. */
export function isToolAllowedAtZoom(tool: Tool, zoom: number, supportsZoomPan: boolean): boolean {
  if (!supportsZoomPan) return true;
  if (!ZOOM_GATED_TOOLS.has(tool)) return true;
  return zoom >= TOOL_ZOOM_GATE_THRESHOLD;
}
