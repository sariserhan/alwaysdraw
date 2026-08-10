import { describe, it, expect } from "vitest";
import { createHeatmapGrid, addStrokesToHeatmap, maxHeatmapCount, findBusiestCell } from "./heatmap";

const WORLD_W = 1000;
const WORLD_H = 1000;
const GRID_SIZE = 10; // 100x100 world units per cell

describe("heatmap grid", () => {
  it("starts empty", () => {
    const grid = createHeatmapGrid(GRID_SIZE);
    expect(maxHeatmapCount(grid)).toBe(0);
    expect(findBusiestCell(grid, WORLD_W, WORLD_H)).toBeNull();
  });

  it("buckets points into the correct cell", () => {
    const grid = createHeatmapGrid(GRID_SIZE);
    addStrokesToHeatmap(grid, [{ points: [{ x: 50, y: 50 }] }], WORLD_W, WORLD_H);
    // (50, 50) with 100-unit cells -> cell (0, 0)
    expect(grid.counts[0]).toBe(1);
    expect(grid.counts.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("accumulates counts across multiple strokes and points", () => {
    const grid = createHeatmapGrid(GRID_SIZE);
    addStrokesToHeatmap(
      grid,
      [
        { points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] },
        { points: [{ x: 15, y: 15 }] },
      ],
      WORLD_W,
      WORLD_H,
    );
    expect(grid.counts[0]).toBe(3); // all three points land in cell (0,0)
  });

  it("clamps out-of-bounds points into the nearest edge cell instead of throwing", () => {
    const grid = createHeatmapGrid(GRID_SIZE);
    addStrokesToHeatmap(
      grid,
      [{ points: [{ x: -50, y: -50 }, { x: WORLD_W + 999, y: WORLD_H + 999 }] }],
      WORLD_W,
      WORLD_H,
    );
    expect(grid.counts[0]).toBe(1); // top-left cell
    expect(grid.counts[grid.counts.length - 1]).toBe(1); // bottom-right cell
  });

  it("finds the busiest cell's world-space center", () => {
    const grid = createHeatmapGrid(GRID_SIZE);
    // Cell (3, 4): x in [300,400), y in [400,500)
    addStrokesToHeatmap(
      grid,
      [
        { points: [{ x: 350, y: 450 }, { x: 360, y: 460 }, { x: 370, y: 470 }] },
        { points: [{ x: 10, y: 10 }] }, // one point elsewhere — should lose
      ],
      WORLD_W,
      WORLD_H,
    );
    expect(findBusiestCell(grid, WORLD_W, WORLD_H)).toEqual({ x: 350, y: 450 });
  });

  it("reports the max count across all cells", () => {
    const grid = createHeatmapGrid(GRID_SIZE);
    addStrokesToHeatmap(
      grid,
      [{ points: [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 900, y: 900 }] }],
      WORLD_W,
      WORLD_H,
    );
    expect(maxHeatmapCount(grid)).toBe(2);
  });
});
