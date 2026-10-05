import { describe, it, expect } from "vitest";
import { DELETED_STROKE_RETENTION_MS } from "@/convex/constants";
import type { ServerStrokeRow } from "./types";
import { isWallCacheEntry, isWallCacheFresh, mergeStrokeRows, WALL_CACHE_MAX_AGE_MS } from "./wallCache";

function row(id: string, sequence: number, deleted = false): ServerStrokeRow {
  return { clientStrokeId: id, sequence, deleted } as unknown as ServerStrokeRow;
}

describe("isWallCacheFresh", () => {
  const syncedAt = 1_000_000;

  it("is fresh inside the retention window", () => {
    expect(isWallCacheFresh({ syncedAt }, syncedAt)).toBe(true);
    expect(isWallCacheFresh({ syncedAt }, syncedAt + WALL_CACHE_MAX_AGE_MS - 1)).toBe(true);
  });

  it("is stale once the retention window has passed", () => {
    expect(isWallCacheFresh({ syncedAt }, syncedAt + WALL_CACHE_MAX_AGE_MS)).toBe(false);
  });

  it("uses the same window as opt-in auto-prune", () => {
    expect(WALL_CACHE_MAX_AGE_MS).toBe(DELETED_STROKE_RETENTION_MS);
  });
});

describe("isWallCacheEntry", () => {
  it("accepts a well-formed entry", () => {
    expect(isWallCacheEntry({ strokes: [], sequence: 5, syncedAt: 1 })).toBe(true);
  });

  it("rejects anything else, so unreadable storage falls back to a full load", () => {
    expect(isWallCacheEntry(null)).toBe(false);
    expect(isWallCacheEntry("garbage")).toBe(false);
    expect(isWallCacheEntry({ strokes: {}, sequence: 5, syncedAt: 1 })).toBe(false);
    expect(isWallCacheEntry({ strokes: [], sequence: "5", syncedAt: 1 })).toBe(false);
  });
});

describe("mergeStrokeRows", () => {
  it("appends new strokes in order", () => {
    const merged = mergeStrokeRows([row("a", 1)], [row("b", 2), row("c", 3)]);
    expect(merged.map((s) => s.clientStrokeId)).toEqual(["a", "b", "c"]);
  });

  it("removes a stroke when its tombstone arrives", () => {
    const merged = mergeStrokeRows([row("a", 1), row("b", 2)], [row("a", 3, true)]);
    expect(merged.map((s) => s.clientStrokeId)).toEqual(["b"]);
  });

  it("drops a stroke that is added and deleted within the same page", () => {
    const merged = mergeStrokeRows([row("a", 1)], [row("b", 2), row("b", 3, true)]);
    expect(merged.map((s) => s.clientStrokeId)).toEqual(["a"]);
  });

  it("ignores a tombstone for a stroke it never had", () => {
    const merged = mergeStrokeRows([row("a", 1)], [row("zzz", 9, true)]);
    expect(merged.map((s) => s.clientStrokeId)).toEqual(["a"]);
  });
});
