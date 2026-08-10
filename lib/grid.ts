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
 * Renders an architectural blueprint grid overlay strictly clipped inside the
 * drawable world canvas boundary [0, worldWidth] x [0, worldHeight].
 */
export function drawGridOverlay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  config: GridConfig,
  worldWidth: number = 20000,
  worldHeight: number = 20000,
) {
  if (config.mode === "none") return;

  const size = config.cellSize || 50;
  const screenCellSize = size * camera.zoom;
  if (screenCellSize < 8) return; // Hide grid when zoomed too far out to prevent moiré patterns

  ctx.save();

  // Screen coordinates for top-left (0,0) and dimensions of world canvas
  const left = (0 - camera.x) * camera.zoom + viewportWidth / 2;
  const top = (0 - camera.y) * camera.zoom + viewportHeight / 2;
  const w = worldWidth * camera.zoom;
  const h = worldHeight * camera.zoom;

  // Clip rendering strictly inside the drawable world canvas rectangle
  ctx.beginPath();
  ctx.rect(left, top, w, h);
  ctx.clip();

  ctx.strokeStyle = "rgba(140, 141, 144, 0.35)";
  ctx.lineWidth = Math.max(1, 1 * camera.zoom);

  const halfVW = viewportWidth / (2 * camera.zoom);
  const halfVH = viewportHeight / (2 * camera.zoom);

  // Clamp grid line iteration strictly to [0, worldWidth] and [0, worldHeight]
  const minX = Math.max(0, Math.floor((camera.x - halfVW) / size) * size);
  const maxX = Math.min(worldWidth, Math.ceil((camera.x + halfVW) / size) * size);
  const minY = Math.max(0, Math.floor((camera.y - halfVH) / size) * size);
  const maxY = Math.min(worldHeight, Math.ceil((camera.y + halfVH) / size) * size);

  if (config.mode === "square") {
    // Vertical grid lines within canvas bounds
    for (let x = minX; x <= maxX; x += size) {
      const screenX = (x - camera.x) * camera.zoom + viewportWidth / 2;
      ctx.beginPath();
      ctx.moveTo(screenX, top);
      ctx.lineTo(screenX, top + h);
      ctx.stroke();
    }

    // Horizontal grid lines within canvas bounds
    for (let y = minY; y <= maxY; y += size) {
      const screenY = (y - camera.y) * camera.zoom + viewportHeight / 2;
      ctx.beginPath();
      ctx.moveTo(left, screenY);
      ctx.lineTo(left + w, screenY);
      ctx.stroke();
    }
  } else if (config.mode === "isometric") {
    // Isometric 30-degree diagonal lines clipped to canvas
    const isoStep = size * Math.sin(Math.PI / 6);
    for (let y = minY; y <= maxY; y += isoStep) {
      const screenY = (y - camera.y) * camera.zoom + viewportHeight / 2;
      ctx.beginPath();
      ctx.moveTo(left, screenY);
      ctx.lineTo(left + w, screenY + w * 0.577);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(left, screenY);
      ctx.lineTo(left + w, screenY - w * 0.577);
      ctx.stroke();
    }
  }

  ctx.restore();
}
