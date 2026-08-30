import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";
import type { Camera } from "./camera";

export type Point = { x: number; y: number };

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): Point {
  return {
    x: camera.x + (screenX - viewportWidth / 2) / camera.zoom,
    y: camera.y + (screenY - viewportHeight / 2) / camera.zoom,
  };
}

export function worldToScreen(
  worldX: number,
  worldY: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
): Point {
  return {
    x: (worldX - camera.x) * camera.zoom + viewportWidth / 2,
    y: (worldY - camera.y) * camera.zoom + viewportHeight / 2,
  };
}

/** Bounds default to the wall's world; Board passes its own (see
 * lib/canvasBackend.ts) — clamping Board input to 20,000 would both let a
 * click in the left/top letterbox snap onto the board's edge and let a drag
 * past the right/bottom edge accumulate points the server then rejects. */
export function clampToWorld(p: Point, width = WORLD_WIDTH, height = WORLD_HEIGHT): Point {
  return {
    x: Math.min(width, Math.max(0, p.x)),
    y: Math.min(height, Math.max(0, p.y)),
  };
}

/** True if a (possibly unclamped) world point falls on the canvas itself, not the void beyond its edge. */
export function isWithinWorld(p: Point, width = WORLD_WIDTH, height = WORLD_HEIGHT): boolean {
  return p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
}
