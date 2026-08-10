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
    // Triangular/Isometric grid lattice:
    // Vertical spacing between rows = size / 2
    // Horizontal spacing between column vertices = size * sqrt(3) / 2
    const rowHeight = size / 2;
    const colWidth = (size * Math.sqrt(3)) / 2;

    const row = Math.round(pt.y / rowHeight);
    const isOddRow = Math.abs(row % 2) === 1;

    // Odd rows are shifted horizontally by colWidth relative to even rows
    const colOffset = isOddRow ? colWidth : 0;
    const col = Math.round((pt.x - colOffset) / (colWidth * 2));

    return {
      x: col * (colWidth * 2) + colOffset,
      y: row * rowHeight,
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
    const sqrt3 = Math.sqrt(3);
    const tan30 = 1 / sqrt3; // ~0.577350269
    const dx = (size * sqrt3) / 2; // ~0.866025 * size

    const worldMinX = camera.x - halfVW;
    const worldMaxX = camera.x + halfVW;
    const worldMinY = camera.y - halfVH;
    const worldMaxY = camera.y + halfVH;

    const toScreenX = (x: number) => (x - camera.x) * camera.zoom + viewportWidth / 2;
    const toScreenY = (y: number) => (y - camera.y) * camera.zoom + viewportHeight / 2;

    // 1. Vertical lines
    const minK = Math.max(0, Math.floor(worldMinX / dx));
    const maxK = Math.min(Math.ceil(worldWidth / dx), Math.ceil(worldMaxX / dx));
    for (let k = minK; k <= maxK; k++) {
      const vx = k * dx;
      const sx = toScreenX(vx);
      ctx.beginPath();
      ctx.moveTo(sx, top);
      ctx.lineTo(sx, top + h);
      ctx.stroke();
    }

    // 2. +30° Diagonal lines (y = x * tan30 + C)
    const minC1 = worldMinY - worldMaxX * tan30;
    const maxC1 = worldMaxY - worldMinX * tan30;
    const startK1 = Math.floor(minC1 / size);
    const endK1 = Math.ceil(maxC1 / size);

    for (let k = startK1; k <= endK1; k++) {
      const C = k * size;
      const x1 = worldMinX;
      const y1 = x1 * tan30 + C;
      const x2 = worldMaxX;
      const y2 = x2 * tan30 + C;

      const sx1 = toScreenX(x1);
      const sy1 = toScreenY(y1);
      const sx2 = toScreenX(x2);
      const sy2 = toScreenY(y2);

      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }

    // 3. -30° Diagonal lines (y = -x * tan30 + C)
    const minC2 = worldMinY + worldMinX * tan30;
    const maxC2 = worldMaxY + worldMaxX * tan30;
    const startK2 = Math.floor(minC2 / size);
    const endK2 = Math.ceil(maxC2 / size);

    for (let k = startK2; k <= endK2; k++) {
      const C = k * size;
      const x1 = worldMinX;
      const y1 = -x1 * tan30 + C;
      const x2 = worldMaxX;
      const y2 = x2 * tan30 + C;

      const sx1 = toScreenX(x1);
      const sy1 = toScreenY(y1);
      const sx2 = toScreenX(x2);
      const sy2 = toScreenY(y2);

      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }
  }

  ctx.restore();
}
