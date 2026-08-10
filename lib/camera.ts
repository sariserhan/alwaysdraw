export type Camera = {
  x: number; // world x at the center of the viewport
  y: number; // world y at the center of the viewport
  zoom: number; // screen px per world px
};

export const MIN_ZOOM = 0.1;
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

/**
 * When the world (at the current zoom) fits entirely within the viewport on
 * an axis, force-center it on that axis instead of leaving it wherever a
 * prior pan left it. Zoomed-in axes are left untouched — only zooming out
 * past "the whole wall fits on screen" snaps back to center.
 */
export function clampCameraToViewport(
  camera: Camera,
  worldWidth: number,
  worldHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): Camera {
  const x = worldWidth * camera.zoom <= viewportWidth ? worldWidth / 2 : camera.x;
  const y = worldHeight * camera.zoom <= viewportHeight ? worldHeight / 2 : camera.y;
  return x === camera.x && y === camera.y ? camera : { ...camera, x, y };
}
