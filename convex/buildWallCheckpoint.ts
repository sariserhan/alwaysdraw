"use node";

import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { PackedStrokes } from "../lib/packedStrokes";

// Stream bounded pages into gzip, so building a large wall doesn't hold the
// whole uncompressed history in memory. The published file is immutable.
export const build = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await ctx.runMutation(internal.wallCheckpoints.cleanup, {});
    const sequence: number = await ctx.runQuery(api.strokes.getHead, {});
    const token = randomUUID();
    if (!await ctx.runMutation(internal.wallCheckpoints.begin, { token, sequence })) return null;
    let stored: Id<"_storage"> | undefined;
    try {
      let strokeCount = 0;
      async function* pages() {
        yield JSON.stringify({ version: 1, sequence }) + "\n";
        let afterSequence = 0;
        while (afterSequence < sequence) {
          const page: PackedStrokes = await ctx.runQuery(api.strokes.listCurrentPacked, {
            afterSequence, throughSequence: sequence,
          });
          if (!page.strokes.length) break;
          yield JSON.stringify(page) + "\n";
          strokeCount += page.strokes.length;
          const last = page.strokes[page.strokes.length - 1].seq;
          if (last <= afterSequence) throw new Error("Checkpoint cursor did not advance");
          afterSequence = last;
          if (page.strokes.length < 1000) break;
        }
      }
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let bytes = 0;
      await pipeline(Readable.from(pages()), createGzip({ level: 6 }), async (source) => {
        for await (const chunk of source) {
          bytes += chunk.length;
          if (bytes > 64 * 1024 * 1024) throw new Error("Checkpoint exceeds size budget");
          chunks.push(new Uint8Array(chunk));
        }
      });
      stored = await ctx.storage.store(new Blob(chunks, { type: "application/gzip" }));
      await ctx.runMutation(internal.wallCheckpoints.finish, { token, sequence, storageId: stored, strokeCount, bytes });
      stored = undefined;
      return null;
    } finally {
      if (stored) await ctx.storage.delete(stored);
      await ctx.runMutation(internal.wallCheckpoints.release, { token });
    }
  },
});
