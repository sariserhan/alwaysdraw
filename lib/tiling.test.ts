import { describe, it, expect } from "vitest";
import {
  getTileCoords,
  getTileId,
  parseTileId,
  getTileBounds,
  isPointInTile,
  getTileKeysForStroke,
  getVisibleTileKeys,
  TILE_SIZE,
} from "./tiling";

describe("spatial tile partitioning (lib/tiling.ts)", () => {
  it("converts world coordinates to tile indices correctly", () => {
    expect(getTileCoords(0, 0)).toEqual({ tileX: 0, tileY: 0 });
    expect(getTileCoords(499, 499)).toEqual({ tileX: 0, tileY: 0 });
    expect(getTileCoords(500, 500)).toEqual({ tileX: 1, tileY: 1 });
    expect(getTileCoords(49999, 49999)).toEqual({ tileX: 99, tileY: 99 });
  });

  it("formats and parses tile IDs", () => {
    const id = getTileId(4, 8);
    expect(id).toBe("tile_4_8");
    expect(parseTileId(id)).toEqual({ tileX: 4, tileY: 8 });
    expect(parseTileId("invalid")).toBeNull();
    expect(parseTileId("tile_abc_def")).toBeNull();
  });

  it("calculates tile bounds in world space", () => {
    const bounds = getTileBounds(2, 3, TILE_SIZE);
    expect(bounds).toEqual({
      minX: 1000,
      minY: 1500,
      maxX: 1500,
      maxY: 2000,
    });
  });

  it("checks if points fall inside tile bounds", () => {
    expect(isPointInTile({ x: 1200, y: 1600 }, 2, 3)).toBe(true);
    expect(isPointInTile({ x: 500, y: 500 }, 2, 3)).toBe(false);
  });

  it("identifies tile keys spanned by a stroke", () => {
    const points = [
      { x: 450, y: 450 }, // Near boundary of tile_0_0 and tile_1_1
      { x: 550, y: 550 },
    ];
    const keys = getTileKeysForStroke(points, 10, 50000, 50000);
    expect(keys).toContain("tile_0_0");
    expect(keys).toContain("tile_1_1");
  });

  it("computes visible tiles for camera viewport with buffer ring", () => {
    // Camera at center of 50k x 50k world, zoom 1x, 1000x1000 viewport
    const camera = { x: 25000, y: 25000, zoom: 1 };
    const keys = getVisibleTileKeys(camera, 1000, 1000, 50000, 50000, 500, 1);
    
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain("tile_50_50");
    expect(keys).toContain("tile_49_49");
    expect(keys).toContain("tile_48_48");
    expect(keys).toContain("tile_52_52");
  });
});
