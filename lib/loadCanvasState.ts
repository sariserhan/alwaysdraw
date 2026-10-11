import type { ServerStroke, ServerStrokeRow } from "./types";
import { replayStrokePages } from "./strokeReplay";

const RANGE_SIZE = 1000;
const CONCURRENCY = 4;

function withTimeout<T>(request: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Wall request timed out")), 15_000);
    request.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Frontend and backend deploy independently. Keep the established API as a
 * fallback, still composing privately so old layers never flash on screen. */
export async function loadCanvasStateWithFallback(
  getHead: () => Promise<number>,
  fetchRange: (args: { afterSequence: number; throughSequence: number }) => Promise<ServerStrokeRow[]>,
  fetchPage: (args: { afterSequence: number; limit: number }) => Promise<ServerStrokeRow[]>,
  isCancelled: () => boolean,
  onProgress: (count: number) => void = () => {},
): Promise<{ strokes: ServerStroke[]; sequence: number } | null> {
  try {
    return await loadCanvasState(
      () => withTimeout(getHead()),
      (args) => withTimeout(fetchRange(args)),
      isCancelled,
      onProgress,
    );
  } catch {
    if (isCancelled()) return null;
    const strokes = new Map<string, ServerStroke>();
    let sequence = 0;
    let count = 0;
    for await (const page of replayStrokePages((args) => withTimeout(fetchPage(args)), isCancelled)) {
      for (const row of page) {
        if (row.deleted) strokes.delete(row.clientStrokeId);
        else strokes.set(row.clientStrokeId, row);
        sequence = Math.max(sequence, row.sequence);
      }
      count += page.length;
      onProgress(count);
    }
    if (isCancelled()) return null;
    return { strokes: [...strokes.values()].sort((a, b) => a.sequence - b.sequence), sequence };
  }
}

/** Build privately, then publish once. No incomplete history escapes to a
 * visible canvas, even if pages finish out of order or loading fails. */
export async function loadCanvasState(
  getHead: () => Promise<number>,
  fetchRange: (args: { afterSequence: number; throughSequence: number }) => Promise<ServerStrokeRow[]>,
  isCancelled: () => boolean,
  onProgress: (count: number) => void = () => {},
): Promise<{ strokes: ServerStroke[]; sequence: number } | null> {
  const rows = new Map<string, ServerStrokeRow>();
  let sequence = 0;
  let failed = false;

  async function loadThrough(head: number) {
    let next = sequence;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (!failed && !isCancelled() && next < head) {
        const afterSequence = next;
        const throughSequence = Math.min(head, next + RANGE_SIZE);
        next = throughSequence;
        const page = await fetchRange({ afterSequence, throughSequence });
        if (failed || isCancelled()) return;
        for (const row of page) {
          const previous = rows.get(row.clientStrokeId);
          if (!previous || row.sequence > previous.sequence) rows.set(row.clientStrokeId, row);
        }
        onProgress(rows.size);
      }
    })).catch((error) => {
      failed = true;
      throw error;
    });
    sequence = head;
  }

  await loadThrough(await getHead());
  if (isCancelled()) return null;
  // Include edits/deletions made while the initial ranges were in flight.
  // A finite catch-up avoids waiting forever on a busy wall. The reactive
  // tail starts at this boundary and delivers everything after it.
  await loadThrough(await getHead());
  if (isCancelled()) return null;
  return {
    strokes: [...rows.values()].filter((row) => !row.deleted).sort((a, b) => a.sequence - b.sequence),
    sequence,
  };
}
