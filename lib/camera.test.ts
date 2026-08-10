import { describe, expect, it } from "vitest";
import {
  clampZoom,
  defaultCamera,
  zoomAt,
  panBy,
  distance,
  clampCameraToViewport,
  MIN_ZOOM,
  MAX_ZOOM,
  type Camera,
} from "./camera";

describe("clampZoom", () => {
  it("passes through values already in range", () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it("clamps below MIN_ZOOM up to MIN_ZOOM", () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
    expect(clampZoom(-5)).toBe(MIN_ZOOM);
  });

  it("clamps above MAX_ZOOM down to MAX_ZOOM", () => {
    expect(clampZoom(1000)).toBe(MAX_ZOOM);
  });
});

describe("defaultCamera", () => {
  it("centers on the world at zoom 1", () => {
    expect(defaultCamera(5000, 5000)).toEqual({ x: 2500, y: 2500, zoom: 1 });
    expect(defaultCamera(10000, 6000)).toEqual({ x: 5000, y: 3000, zoom: 1 });
  });
});

describe("zoomAt", () => {
  it("keeps the world point under the cursor fixed", () => {
    const camera: Camera = { x: 2500, y: 2500, zoom: 1 };
    const viewportWidth = 1200;
    const viewportHeight = 800;
    const screenX = 900;
    const screenY = 300;

    const worldBefore = {
      x: camera.x + (screenX - viewportWidth / 2) / camera.zoom,
      y: camera.y + (screenY - viewportHeight / 2) / camera.zoom,
    };

    const zoomed = zoomAt(camera, 2, screenX, screenY, viewportWidth, viewportHeight);

    const worldAfter = {
      x: zoomed.x + (screenX - viewportWidth / 2) / zoomed.zoom,
      y: zoomed.y + (screenY - viewportHeight / 2) / zoomed.zoom,
    };

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
  });

  it("multiplies zoom by the given factor, clamped to range", () => {
    const camera: Camera = { x: 0, y: 0, zoom: 1 };
    const zoomed = zoomAt(camera, 3, 0, 0, 100, 100);
    expect(zoomed.zoom).toBe(3);

    const clamped = zoomAt(camera, 1000, 0, 0, 100, 100);
    expect(clamped.zoom).toBe(MAX_ZOOM);
  });

  it("zooming centered on the viewport center leaves camera.x/y unchanged", () => {
    const camera: Camera = { x: 500, y: 500, zoom: 1 };
    const zoomed = zoomAt(camera, 2, 400, 300, 800, 600);
    expect(zoomed.x).toBeCloseTo(500, 9);
    expect(zoomed.y).toBeCloseTo(500, 9);
  });
});

describe("panBy", () => {
  it("shifts world position opposite the drag direction, scaled by zoom", () => {
    const camera: Camera = { x: 100, y: 200, zoom: 2 };
    const panned = panBy(camera, 20, -40);
    expect(panned.x).toBeCloseTo(100 - 20 / 2, 9);
    expect(panned.y).toBeCloseTo(200 - -40 / 2, 9);
    expect(panned.zoom).toBe(2);
  });

  it("is a no-op for a zero delta", () => {
    const camera: Camera = { x: 10, y: 10, zoom: 1.5 };
    expect(panBy(camera, 0, 0)).toEqual(camera);
  });
});

describe("distance", () => {
  it("computes euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });
});

describe("clampCameraToViewport", () => {
  it("forces the camera to center when the world fits within the viewport", () => {
    const camera: Camera = { x: 9999, y: -500, zoom: 0.1 };
    const clamped = clampCameraToViewport(camera, 5000, 5000, 1000, 1000);
    expect(clamped).toEqual({ x: 2500, y: 2500, zoom: 0.1 });
  });

  it("leaves the camera untouched when zoomed in past fit", () => {
    const camera: Camera = { x: 1234, y: 4321, zoom: 2 };
    const clamped = clampCameraToViewport(camera, 5000, 5000, 1000, 1000);
    expect(clamped).toEqual(camera);
  });

  it("clamps each axis independently", () => {
    // World fits horizontally (5000 * 0.15 = 750 <= 1000) but not vertically
    // (5000 * 0.15 = 750 > 600).
    const camera: Camera = { x: 9999, y: 9999, zoom: 0.15 };
    const clamped = clampCameraToViewport(camera, 5000, 5000, 1000, 600);
    expect(clamped.x).toBe(2500);
    expect(clamped.y).toBe(9999);
  });
});
