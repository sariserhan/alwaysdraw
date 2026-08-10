import { describe, expect, it } from "vitest";
import { screenToWorld, worldToScreen, clampToWorld } from "./coordinates";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";
import type { Camera } from "./camera";

const CAMERAS: Camera[] = [
  { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 1 },
  { x: 1000, y: 3000, zoom: 2.5 },
  { x: 4200, y: 900, zoom: 0.3 },
];

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
];

describe("screenToWorld / worldToScreen", () => {
  for (const camera of CAMERAS) {
    for (const viewport of VIEWPORTS) {
      it(`are inverses at zoom ${camera.zoom}, viewport ${viewport.width}x${viewport.height}`, () => {
        const screenPoint = { x: viewport.width * 0.3, y: viewport.height * 0.7 };
        const world = screenToWorld(
          screenPoint.x,
          screenPoint.y,
          camera,
          viewport.width,
          viewport.height,
        );
        const screenBack = worldToScreen(world.x, world.y, camera, viewport.width, viewport.height);
        expect(screenBack.x).toBeCloseTo(screenPoint.x, 9);
        expect(screenBack.y).toBeCloseTo(screenPoint.y, 9);
      });
    }
  }

  it("maps the viewport center to the camera's world position", () => {
    const camera: Camera = { x: 1234, y: 5678, zoom: 1.7 };
    const center = screenToWorld(400, 300, camera, 800, 600);
    expect(center.x).toBeCloseTo(camera.x, 9);
    expect(center.y).toBeCloseTo(camera.y, 9);
  });

  it("scales screen distance by zoom", () => {
    const camera: Camera = { x: 0, y: 0, zoom: 2 };
    // One world unit right of center should land 2 screen px right of center.
    const screen = worldToScreen(1, 0, camera, 100, 100);
    expect(screen.x).toBeCloseTo(50 + 2, 9);
  });
});

describe("clampToWorld", () => {
  it("passes through points already inside the world bounds", () => {
    const p = { x: 100, y: 200 };
    expect(clampToWorld(p)).toEqual(p);
  });

  it("clamps negative coordinates to 0", () => {
    expect(clampToWorld({ x: -50, y: -1 })).toEqual({ x: 0, y: 0 });
  });

  it("clamps coordinates beyond the world size to the max", () => {
    expect(clampToWorld({ x: WORLD_WIDTH + 500, y: WORLD_HEIGHT + 1 })).toEqual({
      x: WORLD_WIDTH,
      y: WORLD_HEIGHT,
    });
  });

  it("clamps each axis independently", () => {
    expect(clampToWorld({ x: -10, y: WORLD_HEIGHT + 10 })).toEqual({ x: 0, y: WORLD_HEIGHT });
  });
});
