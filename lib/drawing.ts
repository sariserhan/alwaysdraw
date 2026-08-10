import type { Camera } from "./camera";
import { worldToScreen } from "./coordinates";
import type { Point, StrokeMode } from "./types";

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

const CONCRETE_FILL = "#f0ebd9";
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
