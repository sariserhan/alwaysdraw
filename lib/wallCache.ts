import { DELETED_STROKE_RETENTION_MS } from "@/convex/constants";
import type { ServerStrokeRow } from "./types";

// The wall's live strokes, saved in the browser so a returning visitor can
// draw the wall at once and sync only what changed since (see GlobalCanvas's
// replay effect). A deletion is a tombstone row with a fresh sequence, so a
// delta sync from `sequence` delivers it. Auto-prune is opt-in and hard-deletes
// a row only once it has been deleted for DELETED_STROKE_RETENTION_MS. So a
// cache synced less than that long ago still receives every tombstone it
// needs: any deletion after `syncedAt` is younger than the retention window.
export const WALL_CACHE_MAX_AGE_MS = DELETED_STROKE_RETENTION_MS;

export interface WallCacheEntry {
  strokes: ServerStrokeRow[];
  /** Highest server sequence the strokes were synced to. */
  sequence: number;
  /** When the sync that produced this entry started, not when it finished. */
  syncedAt: number;
}

const DB_NAME = "alwaysdraw-wall-cache";
const STORE_NAME = "wall";
const RECORD_KEY = "wall";

export function isWallCacheFresh(entry: Pick<WallCacheEntry, "syncedAt">, now: number): boolean {
  return now - entry.syncedAt < WALL_CACHE_MAX_AGE_MS;
}

export function isWallCacheEntry(value: unknown): value is WallCacheEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<WallCacheEntry>;
  return Array.isArray(v.strokes) && typeof v.sequence === "number" && typeof v.syncedAt === "number";
}

/** Applies one page of server rows in order: a deletion removes its stroke,
 * anything else is appended. A stroke deleted within the same page is dropped. */
export function mergeStrokeRows(current: ServerStrokeRow[], rows: ServerStrokeRow[]): ServerStrokeRow[] {
  const removed = new Set<string>();
  for (const r of rows) if (r.deleted) removed.add(r.clientStrokeId);
  const kept = removed.size > 0 ? current.filter((c) => !removed.has(c.clientStrokeId)) : current;
  const added = rows.filter((r) => !r.deleted && !removed.has(r.clientStrokeId));
  return added.length > 0 ? [...kept, ...added] : kept;
}

function openWallCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Returns the saved wall, or null when there is none or the browser can't
 * read storage. Callers then fall back to a full load. */
export async function readWallCache(): Promise<WallCacheEntry | null> {
  try {
    const db = await openWallCacheDb();
    const value = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return isWallCacheEntry(value) ? value : null;
  } catch {
    return null;
  }
}

/** Best effort. Private browsing or a full quota just means the next visit
 * loads the wall in full. */
export async function writeWallCache(entry: WallCacheEntry): Promise<void> {
  try {
    const db = await openWallCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry, RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Storage unavailable: nothing to do.
  }
}
