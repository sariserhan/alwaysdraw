import type { Point } from "./types";
import type { Camera } from "./camera";

export type GridMode = "none" | "square" | "isometric";

export interface GridConfig {
  mode: GridMode;
  cellSize: number;
  snapEnabled: boolean;
}

export function snapPointToGrid(pt: Point, config: GridConfig): Point {
  if (!config.snapEnabled || config.mode === "none") return pt;

  const size = config.cellSize || 50;

  if (config.mode === "square") {
    return {
      x: Math.round(pt.x / size) * size,
      y: Math.round(pt.y / size) * size,
    };
  }

  if (config.mode === "isometric") {
    // Isometric 30-degree grid snapping
    const h = size * Math.sin(Math.PI / 6);
    const row = Math.round(pt.y / h);
    const colShift = row % 2 === 0 ? 0 : size / 2;
    const col = Math.round((pt.x - colShift) / size);

    return {
      x: col * size + colShift,
      y: row * h,
    };
  }

  return pt;
}

/**
 * Renders an architectural blueprint grid overlay on the world canvas layer.
 */
export function drawGridOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  config: GridConfig,
) {
  if (config.mode === "none") return;

  const size = config.cellSize || 50;
  const screenCellSize = size * camera.zoom;
  if (screenCellSize < 8) return; // Hide grid when zoomed too far out to prevent moiré patterns

  ctx.save();
  ctx.strokeStyle = "rgba(140, 141, 144, 0.25)";
  ctx.lineWidth = Math.max(1, 1 * camera.zoom);

  const halfVW = viewportWidth / (2 * camera.zoom);
  const halfVH = viewportHeight / (2 * camera.zoom);

  const minX = Math.floor((camera.x - halfVW) / size) * size;
  const maxX = Math.ceil((camera.x + halfVW) / size) * size;
  const minY = Math.floor((camera.y - halfVH) / size) * size;
  const maxY = Math.ceil((camera.y + halfVH) / size) * size;

  if (config.mode === "square") {
    // Vertical grid lines
    for (let x = minX; x <= maxX; x += size) {
      const screenX = (x - camera.x) * camera.zoom + viewportWidth / 2;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, viewportHeight);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let y = minY; y <= maxY; y += size) {
      const screenY = (y - camera.y) * camera.zoom + viewportHeight / 2;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(viewportWidth, screenY);
      ctx.stroke();
    }
  } else if (config.mode === "isometric") {
    // Isometric 30-degree diagonal lines
    const h = size * Math.sin(Math.PI / 6);
    for (let y = minY; y <= maxY; y += h) {
      const screenY = (y - camera.y) * camera.zoom + viewportHeight / 2;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(viewportWidth, screenY + viewportWidth * 0.577);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(viewportWidth, screenY - viewportWidth * 0.577);
      ctx.stroke();
    }
  }

  ctx.restore();
}
