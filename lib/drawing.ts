import type { Camera } from "./camera";
import { worldToScreen } from "./coordinates";
import type { Point, StrokeMode } from "./types";
import type { HeatmapGrid } from "./heatmap";

export const CONCRETE_FILL = "#f0ebd9";

export function configureContext(ctx: CanvasRenderingContext2D) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/** Draws one stroke (already-batched chunk of points) transformed into screen space. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  points: Point[],
  mode: StrokeMode,
  color: string,
  width: number,
) {
  if (points.length === 0) return;
  configureContext(ctx);
  const screenWidth = Math.max(1, width * camera.zoom);
  ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = screenWidth;

  const screenPoints = points.map((p) =>
    worldToScreen(p.x, p.y, camera, viewportWidth, viewportHeight),
  );

  if (screenPoints.length === 1) {
    const p = screenPoints[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, screenWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i++) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    ctx.stroke();
  }

  ctx.globalCompositeOperation = "source-over";
}

/** Draws just the newest segment of an in-progress local stroke (cheap, no clear/redraw). */
export function drawSegment(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  from: Point,
  to: Point,
  mode: StrokeMode,
  color: string,
  width: number,
) {
  drawStroke(ctx, camera, viewportWidth, viewportHeight, [from, to], mode, color, width);
}

export function clearCanvas(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  void viewportWidth;
  void viewportHeight;
}

const RUST = "#b5502c";

/**
 * Renders the shared wall: a plain flat paper-toned fill with a rust-bordered
 * edge. Deliberately no grid, crack, or grain texture — that visual noise
 * competed with the strokes actually drawn on it, so the ground stays plain
 * and the drawing is the only complexity.
 */
export function drawWorldBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
) {
  const topLeft = worldToScreen(0, 0, camera, viewportWidth, viewportHeight);
  const bottomRight = worldToScreen(worldWidth, worldHeight, camera, viewportWidth, viewportHeight);
  const rectX = topLeft.x;
  const rectY = topLeft.y;
  const rectW = bottomRight.x - topLeft.x;
  const rectH = bottomRight.y - topLeft.y;

  ctx.fillStyle = CONCRETE_FILL;
  ctx.fillRect(rectX, rectY, rectW, rectH);

  ctx.strokeStyle = RUST;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  ctx.strokeRect(rectX, rectY, rectW, rectH);
  ctx.globalAlpha = 1;
}

export function fillMiniMapBackground(ctx: CanvasRenderingContext2D, size: number) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = CONCRETE_FILL;
  ctx.fillRect(0, 0, size, size);
}

/**
 * Paints strokes onto the mini-map at a flat linear world->minimap scale (the
 * minimap always shows the whole fixed world, so no camera/zoom is involved).
 * Deliberately simplified vs. the real brush renderers — a thin colored line
 * per stroke — since texture is invisible at this scale and full brush
 * rendering for thousands of strokes would be wasted work. Erase is painted
 * with the background color rather than destination-out: unlike the main
 * view (background + strokes on two separate canvas layers, so erasing only
 * clears the strokes layer), the minimap is one flat canvas with the
 * background baked in — destination-out there would punch a genuinely
 * transparent hole through the background too. Appends onto whatever's
 * already there; does not clear.
 */
export function paintMiniMapStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Array<{ mode: StrokeMode; color: string; points: Point[] }>,
  size: number,
  worldWidth: number,
  worldHeight: number,
) {
  const scaleX = size / worldWidth;
  const scaleY = size / worldHeight;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.25;
  ctx.globalCompositeOperation = "source-over";
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    ctx.strokeStyle = s.mode === "erase" ? CONCRETE_FILL : s.color;
    ctx.beginPath();
    const first = s.points[0];
    ctx.moveTo(first.x * scaleX, first.y * scaleY);
    if (s.points.length === 1) {
      ctx.lineTo(first.x * scaleX + 0.01, first.y * scaleY + 0.01); // dot: a visible pixel, not a zero-length no-op path
    } else {
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * scaleX, s.points[i].y * scaleY);
      }
    }
    ctx.stroke();
  }
}

const HEATMAP_COLOR_RGB = "224, 67, 43"; // accent-crimson

/**
 * Paints one filled, alpha-graded rect per non-empty grid cell, in screen
 * space via the same camera transform as everything else — so it pans/zooms
 * with the wall. Caller clears the canvas first (same convention as
 * drawWorldBackground); this only paints.
 */
export function drawHeatmapOverlay(
  ctx: CanvasRenderingContext2D,
  grid: HeatmapGrid,
  maxCount: number,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
) {
  if (maxCount <= 0) return;
  const { counts, gridSize } = grid;
  const cellW = worldWidth / gridSize;
  const cellH = worldHeight / gridSize;
  for (let cy = 0; cy < gridSize; cy++) {
    for (let cx = 0; cx < gridSize; cx++) {
      const count = counts[cy * gridSize + cx];
      if (count <= 0) continue;
      const intensity = Math.min(1, count / maxCount);
      const topLeft = worldToScreen(cx * cellW, cy * cellH, camera, viewportWidth, viewportHeight);
      const bottomRight = worldToScreen(
        (cx + 1) * cellW,
        (cy + 1) * cellH,
        camera,
        viewportWidth,
        viewportHeight,
      );
      ctx.fillStyle = `rgba(${HEATMAP_COLOR_RGB}, ${(0.12 + intensity * 0.58).toFixed(3)})`;
      ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }
  }
}
