import type { Point } from "./types";

export const TILE_SIZE = 500;

export type TileCoord = {
  tileX: number;
  tileY: number;
};

export type TileBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** Convert world-space coordinate (x, y) to tile index (tileX, tileY). */
export function getTileCoords(x: number, y: number, tileSize: number = TILE_SIZE): TileCoord {
  return {
    tileX: Math.floor(x / tileSize),
    tileY: Math.floor(y / tileSize),
  };
}

/** Format tile index to string ID (e.g., "tile_4_8"). */
export function getTileId(tileX: number, tileY: number): string {
  return `tile_${tileX}_${tileY}`;
}

/** Parse tile ID string back to numeric indices. */
export function parseTileId(tileId: string): TileCoord | null {
  const parts = tileId.split("_");
  if (parts.length !== 3 || parts[0] !== "tile") return null;
  const tileX = parseInt(parts[1], 10);
  const tileY = parseInt(parts[2], 10);
  if (isNaN(tileX) || isNaN(tileY)) return null;
  return { tileX, tileY };
}

/** Get bounding box for a tile in world-space coordinates. */
export function getTileBounds(
  tileX: number,
  tileY: number,
  tileSize: number = TILE_SIZE,
): TileBounds {
  return {
    minX: tileX * tileSize,
    minY: tileY * tileSize,
    maxX: (tileX + 1) * tileSize,
    maxY: (tileY + 1) * tileSize,
  };
}

/** Check if a point falls within a tile's bounds. */
export function isPointInTile(
  point: Point,
  tileX: number,
  tileY: number,
  tileSize: number = TILE_SIZE,
): boolean {
  const bounds = getTileBounds(tileX, tileY, tileSize);
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

/**
 * Returns all unique tile IDs spanned by a stroke's point list.
 * Includes bounding box padding for line stroke width.
 */
export function getTileKeysForStroke(
  points: Point[],
  strokeWidth: number = 8,
  worldWidth: number = 50000,
  worldHeight: number = 50000,
  tileSize: number = TILE_SIZE,
): string[] {
  if (!points || points.length === 0) return [];

  const maxTileX = Math.max(0, Math.floor(worldWidth / tileSize) - 1);
  const maxTileY = Math.max(0, Math.floor(worldHeight / tileSize) - 1);

  const tileSet = new Set<string>();
  const radius = strokeWidth / 2;

  const tagPoint = (x: number, y: number) => {
    const minTX = Math.max(0, Math.min(maxTileX, Math.floor((x - radius) / tileSize)));
    const maxTX = Math.max(0, Math.min(maxTileX, Math.floor((x + radius) / tileSize)));
    const minTY = Math.max(0, Math.min(maxTileY, Math.floor((y - radius) / tileSize)));
    const maxTY = Math.max(0, Math.min(maxTileY, Math.floor((y + radius) / tileSize)));

    for (let tx = minTX; tx <= maxTX; tx++) {
      for (let ty = minTY; ty <= maxTY; ty++) {
        tileSet.add(getTileId(tx, ty));
      }
    }
  };

  tagPoint(points[0].x, points[0].y);

  // Also tag tiles along each segment, not just the recorded points, so
  // straight-line jumps between far-apart points (e.g. the line tool) don't
  // skip tiles the rendered stroke actually passes through.
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / (tileSize / 2)));

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      tagPoint(prev.x + dx * t, prev.y + dy * t);
    }
  }

  return Array.from(tileSet);
}

/**
 * Calculate the set of tile keys visible within the camera's viewport plus a buffer ring.
 */
export function getVisibleTileKeys(
  camera: { x: number; y: number; zoom: number },
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number = 50000,
  worldHeight: number = 50000,
  tileSize: number = TILE_SIZE,
  buffer: number = 1,
): string[] {
  const halfVW = viewportWidth / (2 * camera.zoom);
  const halfVH = viewportHeight / (2 * camera.zoom);

  const minWorldX = camera.x - halfVW;
  const maxWorldX = camera.x + halfVW;
  const minWorldY = camera.y - halfVH;
  const maxWorldY = camera.y + halfVH;

  const maxTileX = Math.max(0, Math.floor((worldWidth - 1) / tileSize));
  const maxTileY = Math.max(0, Math.floor((worldHeight - 1) / tileSize));

  const startTileX = Math.max(0, Math.floor(minWorldX / tileSize) - buffer);
  const endTileX = Math.min(maxTileX, Math.floor(maxWorldX / tileSize) + buffer);
  const startTileY = Math.max(0, Math.floor(minWorldY / tileSize) - buffer);
  const endTileY = Math.min(maxTileY, Math.floor(maxWorldY / tileSize) + buffer);

  const tileKeys: string[] = [];
  for (let tx = startTileX; tx <= endTileX; tx++) {
    for (let ty = startTileY; ty <= endTileY; ty++) {
      tileKeys.push(getTileId(tx, ty));
    }
  }

  return tileKeys;
}

/** Determine tile size based on zoom level (mipmapping for ultra-low zoom). */
export function getMipmapTileSize(zoom: number): number {
  if (zoom < 0.25) return TILE_SIZE * 5; // 2500px super-tiles
  if (zoom < 0.5) return TILE_SIZE * 2; // 1000px super-tiles
  return TILE_SIZE; // 500px standard tiles
}
