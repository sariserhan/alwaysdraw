import type { ServerStroke, ServerStrokeRow } from "./types";

const RANGE_SIZE = 1000;
const CONCURRENCY = 4;

/** Build privately, then publish once. No incomplete history escapes to a
 * visible canvas, even if pages finish out of order or loading fails. */
export async function loadCanvasState(
  getHead: () => Promise<number>,
  fetchRange: (args: { afterSequence: number; throughSequence: number }) => Promise<ServerStrokeRow[]>,
  isCancelled: () => boolean,
): Promise<{ strokes: ServerStroke[]; sequence: number } | null> {
  const rows = new Map<string, ServerStrokeRow>();
  let sequence = 0;

  async function loadThrough(head: number) {
    let next = sequence;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (!isCancelled() && next < head) {
        const afterSequence = next;
        const throughSequence = Math.min(head, next + RANGE_SIZE);
        next = throughSequence;
        const page = await fetchRange({ afterSequence, throughSequence });
        if (isCancelled()) return;
        for (const row of page) {
          const previous = rows.get(row.clientStrokeId);
          if (!previous || row.sequence > previous.sequence) rows.set(row.clientStrokeId, row);
        }
      }
    }));
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
