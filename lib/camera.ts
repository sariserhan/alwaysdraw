export type Camera = {
  x: number; // world x at the center of the viewport
  y: number; // world y at the center of the viewport
  zoom: number; // screen px per world px
};

// Low enough that even a modest ~800px-wide viewport can still fit the whole
// WORLD_WIDTH at once — (viewport px) / MIN_ZOOM must stay well
// above the world size. Re-check this whenever the world size changes; it
// silently broke "see the whole wall" once already when the world grew and
// this constant wasn't revisited.
export const MIN_ZOOM = 0.025;
export const MAX_ZOOM = 8;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function defaultCamera(worldWidth: number, worldHeight: number): Camera {
  return { x: worldWidth / 2, y: worldHeight / 2, zoom: 1 };
}

/** Zoom by `factor` (relative), keeping the world point under (screenX, screenY) fixed. */
export function zoomAt(
  camera: Camera,
  factor: number,
  screenX: number,
  screenY: number,
  viewportWidth: number,
  viewportHeight: number,
): Camera {
  const newZoom = clampZoom(camera.zoom * factor);
  const worldBefore = {
    x: camera.x + (screenX - viewportWidth / 2) / camera.zoom,
    y: camera.y + (screenY - viewportHeight / 2) / camera.zoom,
  };
  return {
    zoom: newZoom,
    x: worldBefore.x - (screenX - viewportWidth / 2) / newZoom,
    y: worldBefore.y - (screenY - viewportHeight / 2) / newZoom,
  };
}

export function panBy(camera: Camera, dxScreen: number, dyScreen: number): Camera {
  return {
    ...camera,
    x: camera.x - dxScreen / camera.zoom,
    y: camera.y - dyScreen / camera.zoom,
  };
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
