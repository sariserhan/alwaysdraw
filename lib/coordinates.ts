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

export function clampToWorld(p: Point): Point {
  return {
    x: Math.min(WORLD_WIDTH, Math.max(0, p.x)),
    y: Math.min(WORLD_HEIGHT, Math.max(0, p.y)),
  };
}

/** True if a (possibly unclamped) world point falls on the wall itself, not the void beyond its edge. */
export function isWithinWorld(p: Point): boolean {
  return p.x >= 0 && p.x <= WORLD_WIDTH && p.y >= 0 && p.y <= WORLD_HEIGHT;
}
