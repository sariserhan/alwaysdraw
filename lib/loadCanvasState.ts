import type { ServerStroke, ServerStrokeRow } from "./types";
import { replayStrokePages } from "./strokeReplay";

const RANGE_SIZE = 1000;
const CONCURRENCY = 4;
type FetchCurrent = (args: { afterSequence: number; throughSequence: number }) => Promise<ServerStrokeRow[]>;

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
  fetchCurrent?: FetchCurrent,
): Promise<{ strokes: ServerStroke[]; sequence: number } | null> {
  try {
    return await loadCanvasState(
      () => withTimeout(getHead()),
      (args) => withTimeout(fetchRange(args)),
      isCancelled,
      onProgress,
      fetchCurrent ? (args) => withTimeout(fetchCurrent(args)) : undefined,
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
  fetchCurrent?: FetchCurrent,
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

  const initialHead = await getHead();
  if (fetchCurrent) {
    // Claim bounded windows dynamically: dense recent artwork must not all
    // land on one worker while the others finish sparse historical ranges.
    const windowSize = RANGE_SIZE * 10;
    let nextWindow = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (!failed && !isCancelled() && nextWindow < initialHead) {
        let afterSequence = nextWindow;
        const throughSequence = Math.min(initialHead, nextWindow + windowSize);
        nextWindow = throughSequence;
        while (!failed && !isCancelled() && afterSequence < throughSequence) {
          const page = await fetchCurrent({ afterSequence, throughSequence });
          if (failed || isCancelled()) return;
          for (const row of page) rows.set(row.clientStrokeId, row);
          onProgress(rows.size);
          if (page.length < RANGE_SIZE) break;
          const lastSequence = page[page.length - 1].sequence;
          if (lastSequence <= afterSequence) throw new Error("Wall cursor did not advance");
          afterSequence = lastSequence;
        }
      }
    })).catch((error) => {
      failed = true;
      throw error;
    });
    sequence = initialHead;
  } else {
    await loadThrough(initialHead);
  }
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
