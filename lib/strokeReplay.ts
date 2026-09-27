import type { ServerStrokeRow } from "./types";

const REPLAY_PAGE_SIZE = 1000;

/** Saved strokes are authoritative. Always start at zero, including when
 * legacy snapshots exist, and keep tombstones for the caller to apply. */
export async function* replayStrokePages(
  fetchPage: (args: { afterSequence: number; limit: number }) => Promise<ServerStrokeRow[]>,
  isCancelled: () => boolean,
): AsyncGenerator<ServerStrokeRow[]> {
  let afterSequence = 0;
  while (!isCancelled()) {
    const page = await fetchPage({ afterSequence, limit: REPLAY_PAGE_SIZE });
    if (isCancelled() || page.length === 0) return;
    yield page;
    afterSequence = page[page.length - 1].sequence;
    if (page.length < REPLAY_PAGE_SIZE) return;
  }
}
