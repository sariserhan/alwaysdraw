import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_SKETCHBOOK_PAGE_ID } from "../lib/sketchbookPages";

// One-time, manually-run backfill for sketchbookStrokes rows written
// before multi-page support existed (no pageId field). Run via
// `npx convex run migrations:backfillSketchbookPageId` after deploying
// the multi-page sketchbook — not invoked automatically by any app code
// or test. Idempotent: rows that already have a pageId are left alone,
// so it's safe to run more than once. Batched at 500 rows per call to
// stay well under Convex's per-mutation read/write limits; if the result
// comes back with done: false, run it again (and again) until done: true.
export const backfillSketchbookPageId = internalMutation({
  args: {},
  returns: v.object({ patched: v.number(), done: v.boolean() }),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("sketchbookStrokes")
      // ponytail: brief's snippet used .filter(q.eq(q.field("pageId"), undefined)),
      // which scans the whole table; this repo's convex-lint rule blocks .filter
      // on db queries, so use the by_pageId_and_sequence index (added in this
      // same task) instead — same rows found, no full scan.
      .withIndex("by_pageId_and_sequence", (q) => q.eq("pageId", undefined))
      .take(500);
    for (const row of rows) {
      await ctx.db.patch(row._id, { pageId: DEFAULT_SKETCHBOOK_PAGE_ID });
    }
    return { patched: rows.length, done: rows.length < 500 };
  },
});
