// Gesture-time cache for the committed strokes on the wall canvas. Replaying
// every stroke on each pan or zoom frame is what made gestures stutter, so
// while the camera moves we paint a cached image of the committed strokes and
// transform it to the current camera instead. The cache is rebuilt only when
// the gesture starts, when the view nears the cache's edge, or when zoomed in
// far enough that the cached pixels would look soft. Once the gesture settles
// the strokes are redrawn crisply from the live data.

export const STROKE_CACHE_MARGIN = 0.5; // cache extends this far past the viewport on each side (larger costs more per-frame blit)
export const MAX_CACHED_ZOOM_IN = 1.5; // rebuild once zoomed in past this ratio, before the cache blurs
export const GESTURE_SETTLE_MS = 150; // quiet time after the last camera move before a crisp redraw
export const CAMERA_SYNC_INTERVAL_MS = 200; // max rate of React camera-state updates during a gesture

export interface CameraLike {
  x: number;
  y: number;
  zoom: number;
}

export interface StrokeCacheFrame {
  /** Camera the cached strokes were painted at. */
  camera: CameraLike;
  /** Viewport size (CSS px) the cache was built for. */
  viewportWidth: number;
  viewportHeight: number;
  /** Size (CSS px) of the cached image: the viewport plus the margin on each side. */
  cacheWidth: number;
  cacheHeight: number;
}

export function createStrokeCacheFrame(
  camera: CameraLike,
  viewportWidth: number,
  viewportHeight: number,
): StrokeCacheFrame {
  return {
    camera: { x: camera.x, y: camera.y, zoom: camera.zoom },
    viewportWidth,
    viewportHeight,
    cacheWidth: viewportWidth * (1 + 2 * STROKE_CACHE_MARGIN),
    cacheHeight: viewportHeight * (1 + 2 * STROKE_CACHE_MARGIN),
  };
}

// A current-screen point maps into cached-image space as: cached = screen * scale + offset.
function cacheMapping(frame: StrokeCacheFrame, camera: CameraLike, width: number, height: number) {
  const scale = frame.camera.zoom / camera.zoom;
  return {
    scale,
    offsetX: frame.cacheWidth / 2 - (width / 2) * scale + (camera.x - frame.camera.x) * frame.camera.zoom,
    offsetY: frame.cacheHeight / 2 - (height / 2) * scale + (camera.y - frame.camera.y) * frame.camera.zoom,
  };
}

/** True when the cached image still covers the whole viewport at a sharp enough zoom. */
export function strokeCacheCovers(
  frame: StrokeCacheFrame,
  camera: CameraLike,
  width: number,
  height: number,
): boolean {
  if (frame.viewportWidth !== width || frame.viewportHeight !== height) return false;
  if (camera.zoom / frame.camera.zoom > MAX_CACHED_ZOOM_IN) return false;
  const { scale, offsetX, offsetY } = cacheMapping(frame, camera, width, height);
  return (
    offsetX >= 0 &&
    offsetY >= 0 &&
    scale * width + offsetX <= frame.cacheWidth &&
    scale * height + offsetY <= frame.cacheHeight
  );
}

/** Where to draw the cached image (CSS px, in the current viewport's coordinates). */
export function strokeCacheDrawRect(
  frame: StrokeCacheFrame,
  camera: CameraLike,
  width: number,
  height: number,
): { dx: number; dy: number; dw: number; dh: number } {
  const { scale, offsetX, offsetY } = cacheMapping(frame, camera, width, height);
  return {
    dx: -offsetX / scale,
    dy: -offsetY / scale,
    dw: frame.cacheWidth / scale,
    dh: frame.cacheHeight / scale,
  };
}

/**
 * Holds the cached image and decides when to rebuild it. `paintCommitted` is
 * the caller's replay of the committed strokes into the cache's own context,
 * so this class stays free of stroke and tile knowledge.
 */
export class StrokeCache {
  private canvas: HTMLCanvasElement | null = null;
  private frame: StrokeCacheFrame | null = null;

  /** Call whenever the committed strokes change; the next draw rebuilds. */
  invalidate(): void {
    this.frame = null;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    camera: CameraLike,
    width: number,
    height: number,
    dpr: number,
    paintCommitted: (cacheCtx: CanvasRenderingContext2D, frame: StrokeCacheFrame) => void,
  ): void {
    if (!this.frame || !strokeCacheCovers(this.frame, camera, width, height)) {
      this.build(camera, width, height, dpr, paintCommitted);
    }
    if (this.canvas && this.frame) {
      const r = strokeCacheDrawRect(this.frame, camera, width, height);
      ctx.drawImage(this.canvas, r.dx, r.dy, r.dw, r.dh);
    }
  }

  // Device resolution, so drawing it back is a 1:1 blit. A 1x cache upscaled
  // onto a 2x screen measured slower per frame in Chrome.
  private build(
    camera: CameraLike,
    width: number,
    height: number,
    dpr: number,
    paintCommitted: (cacheCtx: CanvasRenderingContext2D, frame: StrokeCacheFrame) => void,
  ): void {
    const frame = createStrokeCacheFrame(camera, width, height);
    const canvas = this.canvas ?? document.createElement("canvas");
    canvas.width = Math.round(frame.cacheWidth * dpr);
    canvas.height = Math.round(frame.cacheHeight * dpr);
    const cacheCtx = canvas.getContext("2d");
    if (!cacheCtx) {
      this.frame = null;
      return;
    }
    cacheCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCommitted(cacheCtx, frame);
    this.canvas = canvas;
    this.frame = frame;
  }
}
