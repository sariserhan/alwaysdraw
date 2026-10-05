import { describe, it, expect } from "vitest";
import { worldToScreen } from "./coordinates";
import {
  createStrokeCacheFrame,
  strokeCacheCovers,
  strokeCacheDrawRect,
  STROKE_CACHE_MARGIN,
} from "./strokeCache";

const W = 1000;
const H = 600;
const base = { x: 5000, y: 5000, zoom: 0.5 };

describe("strokeCache", () => {
  it("draws a world point at the same screen position the live camera would", () => {
    const frame = createStrokeCacheFrame(base, W, H);
    const camera = { x: 5100, y: 4950, zoom: 0.6 };
    const world = { x: 5210, y: 4880 };

    const onScreen = worldToScreen(world.x, world.y, camera, W, H);
    const inCache = worldToScreen(world.x, world.y, frame.camera, frame.cacheWidth, frame.cacheHeight);
    const rect = strokeCacheDrawRect(frame, camera, W, H);
    const scale = (rect.dw / frame.cacheWidth);

    expect(rect.dx + inCache.x * scale).toBeCloseTo(onScreen.x, 6);
    expect(rect.dy + inCache.y * scale).toBeCloseTo(onScreen.y, 6);
  });

  it("covers small pans and zooms out, and draws the cache at the same place when unchanged", () => {
    const frame = createStrokeCacheFrame(base, W, H);
    expect(strokeCacheCovers(frame, base, W, H)).toBe(true);
    expect(strokeCacheCovers(frame, { ...base, x: base.x + 100 }, W, H)).toBe(true);
    expect(strokeCacheCovers(frame, { ...base, zoom: base.zoom * 0.7 }, W, H)).toBe(true);
  });

  it("stops covering once the viewport pans past the margin", () => {
    const frame = createStrokeCacheFrame(base, W, H);
    const pastEdge = base.x + (W / 2) * (1 + STROKE_CACHE_MARGIN) / base.zoom + 10;
    expect(strokeCacheCovers(frame, { ...base, x: pastEdge }, W, H)).toBe(false);
  });

  it("stops covering once zoomed in far enough that cached pixels would look soft", () => {
    const frame = createStrokeCacheFrame(base, W, H);
    expect(strokeCacheCovers(frame, { ...base, zoom: base.zoom * 1.4 }, W, H)).toBe(true);
    expect(strokeCacheCovers(frame, { ...base, zoom: base.zoom * 1.6 }, W, H)).toBe(false);
  });

  it("stops covering when the viewport is resized", () => {
    const frame = createStrokeCacheFrame(base, W, H);
    expect(strokeCacheCovers(frame, base, W + 1, H)).toBe(false);
  });
});
