import type { Camera } from "./camera";
import { clampZoom } from "./camera";
import { clampToWorld } from "./coordinates";

const PARAM_X = "x";
const PARAM_Y = "y";
const PARAM_Z = "z";

/** Reads ?x=&y=&z= into a valid, clamped Camera — or null if any are missing/non-finite. */
export function parseCameraFromSearch(search: string): Camera | null {
  const params = new URLSearchParams(search);
  const xStr = params.get(PARAM_X);
  const yStr = params.get(PARAM_Y);
  const zStr = params.get(PARAM_Z);
  if (xStr === null || yStr === null || zStr === null) return null;

  const x = Number(xStr);
  const y = Number(yStr);
  const z = Number(zStr);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

  const clamped = clampToWorld({ x, y });
  return { x: clamped.x, y: clamped.y, zoom: clampZoom(z) };
}

/** ?x=&y=&z= query string (no leading "?") for a camera — whole world px, 3-decimal zoom, for a tidy shareable URL. */
export function cameraToSearchString(camera: Camera): string {
  return new URLSearchParams({
    [PARAM_X]: String(Math.round(camera.x)),
    [PARAM_Y]: String(Math.round(camera.y)),
    [PARAM_Z]: camera.zoom.toFixed(3),
  }).toString();
}
