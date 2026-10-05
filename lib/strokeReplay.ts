import type { ServerStrokeRow } from "./types";

const REPLAY_PAGE_SIZE = 1000;

/** Saved strokes are authoritative. Start at zero unless a cached copy already
 * covers everything up to `startAfter`, and keep tombstones for the caller to apply. */
export async function* replayStrokePages(
  fetchPage: (args: { afterSequence: number; limit: number }) => Promise<ServerStrokeRow[]>,
  isCancelled: () => boolean,
  startAfter = 0,
): AsyncGenerator<ServerStrokeRow[]> {
  let afterSequence = startAfter;
  while (!isCancelled()) {
    const page = await fetchPage({ afterSequence, limit: REPLAY_PAGE_SIZE });
    if (isCancelled() || page.length === 0) return;
    yield page;
    afterSequence = page[page.length - 1].sequence;
    if (page.length < REPLAY_PAGE_SIZE) return;
  }
}
