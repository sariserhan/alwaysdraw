import type { Point } from "./types";

/**
 * Coarse grid of "how much interaction happened here" — counts every point
 * of every stroke (draw and erase both count; erasing is still someone
 * interacting with that spot) into fixed-size world-space cells. Built
 * client-side from strokes already loaded for replay/the mini-map — no
 * separate backend aggregation needed.
 */
export type HeatmapGrid = {
  counts: Float64Array;
  gridSize: number;
};

export function createHeatmapGrid(gridSize: number): HeatmapGrid {
  return { counts: new Float64Array(gridSize * gridSize), gridSize };
}

export function addStrokesToHeatmap(
  grid: HeatmapGrid,
  strokes: Array<{ points: Point[] }>,
  worldWidth: number,
  worldHeight: number,
) {
  const { counts, gridSize } = grid;
  const cellW = worldWidth / gridSize;
  const cellH = worldHeight / gridSize;
  for (const s of strokes) {
    for (const p of s.points) {
      const cx = Math.min(gridSize - 1, Math.max(0, Math.floor(p.x / cellW)));
      const cy = Math.min(gridSize - 1, Math.max(0, Math.floor(p.y / cellH)));
      counts[cy * gridSize + cx] += 1;
    }
  }
}

export function maxHeatmapCount(grid: HeatmapGrid): number {
  let max = 0;
  for (let i = 0; i < grid.counts.length; i++) {
    if (grid.counts[i] > max) max = grid.counts[i];
  }
  return max;
}

/** World-space center of the single busiest cell, or null if the grid is empty. */
export function findBusiestCell(
  grid: HeatmapGrid,
  worldWidth: number,
  worldHeight: number,
): Point | null {
  const { counts, gridSize } = grid;
  let bestIdx = -1;
  let bestVal = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > bestVal) {
      bestVal = counts[i];
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  const cellW = worldWidth / gridSize;
  const cellH = worldHeight / gridSize;
  const cx = bestIdx % gridSize;
  const cy = Math.floor(bestIdx / gridSize);
  return { x: (cx + 0.5) * cellW, y: (cy + 0.5) * cellH };
}

/** World-space center of a randomly selected active cell (with > 0 counts), or null if empty. */
export function findRandomActiveCell(
  grid: HeatmapGrid,
  worldWidth: number,
  worldHeight: number,
  excludePoint?: Point,
): Point | null {
  const { counts, gridSize } = grid;
  const activeIndices: number[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) activeIndices.push(i);
  }
  if (activeIndices.length === 0) return null;

  const cellW = worldWidth / gridSize;
  const cellH = worldHeight / gridSize;

  let candidates = activeIndices;
  if (excludePoint && activeIndices.length > 1) {
    const currentCx = Math.min(gridSize - 1, Math.max(0, Math.floor(excludePoint.x / cellW)));
    const currentCy = Math.min(gridSize - 1, Math.max(0, Math.floor(excludePoint.y / cellH)));
    const currentIdx = currentCy * gridSize + currentCx;
    const filtered = activeIndices.filter((idx) => idx !== currentIdx);
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  const chosenIdx = candidates[Math.floor(Math.random() * candidates.length)];
  const cx = chosenIdx % gridSize;
  const cy = Math.floor(chosenIdx / gridSize);
  return { x: (cx + 0.5) * cellW, y: (cy + 0.5) * cellH };
}

/** Returns average point of the latest stroke in an array, or null if empty. */
export function findLatestStrokeCenter(strokes: Array<{ points: Point[] }>): Point | null {
  if (!strokes || strokes.length === 0) return null;
  const last = strokes[strokes.length - 1];
  if (!last.points || last.points.length === 0) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of last.points) {
    sumX += p.x;
    sumY += p.y;
  }
  return { x: sumX / last.points.length, y: sumY / last.points.length };
}
