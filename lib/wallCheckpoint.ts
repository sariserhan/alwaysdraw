import { unpackStrokes, type PackedStrokes } from "./packedStrokes";
import type { ServerStroke } from "./types";

export type WallCheckpoint = {
  url: string; sequence: number; strokeCount: number; bytes: number; createdAt: number;
};
export type CanvasState = { strokes: ServerStroke[]; sequence: number };

/** Decode privately, one page at a time. A failed or incomplete stream must
 * never become visible; the caller falls back to the normal query path. */
export async function readWallCheckpoint(
  body: ReadableStream<Uint8Array<ArrayBuffer>>, manifest: WallCheckpoint,
  isCancelled: () => boolean, onProgress: (count: number) => void,
): Promise<CanvasState | null> {
  const reader = body.pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TextDecoderStream()).getReader();
  const strokes: ServerStroke[] = [];
  let buffered = "";
  let header = false;
  let lastSequence = 0;
  function line(text: string) {
    if (!header) {
      const value = JSON.parse(text);
      if (value.version !== 1 || value.sequence !== manifest.sequence) throw new Error("Invalid wall checkpoint version or boundary");
      header = true;
      return;
    }
    const page = unpackStrokes(JSON.parse(text) as PackedStrokes);
    for (const stroke of page) {
      if (!Number.isSafeInteger(stroke.sequence) || stroke.sequence <= lastSequence || stroke.sequence > manifest.sequence) {
        throw new Error("Invalid wall checkpoint order");
      }
      lastSequence = stroke.sequence;
      strokes.push(stroke);
    }
    onProgress(strokes.length);
  }
  try {
    for (;;) {
      if (isCancelled()) return null;
      const { value, done } = await reader.read();
      if (done) break;
      buffered += value;
      let end: number;
      while ((end = buffered.indexOf("\n")) !== -1) {
        line(buffered.slice(0, end));
        buffered = buffered.slice(end + 1);
      }
    }
    if (isCancelled()) return null;
    if (!header || buffered.length || strokes.length !== manifest.strokeCount) {
      throw new Error("Incomplete wall checkpoint");
    }
    return { strokes, sequence: manifest.sequence };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function fetchWallCheckpoint(
  manifest: WallCheckpoint | null,
  isCancelled: () => boolean, onProgress: (count: number) => void,
): Promise<CanvasState | null> {
  // The server also checks age; check again here because query results may be
  // cached. This stays comfortably inside the 24-hour tombstone retention.
  if (!manifest || Date.now() - manifest.createdAt > 30 * 60_000 || typeof DecompressionStream === "undefined") return null;
  const response = await fetch(manifest.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error("Could not download wall checkpoint");
  return readWallCheckpoint(response.body, manifest, isCancelled, onProgress);
}
