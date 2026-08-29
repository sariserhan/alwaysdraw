import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { verifyAdminPasscode } from "./admin";
import { claimNextSequence } from "./boardMetadata";
import { BOARD_WIPE_BATCH_SIZE } from "./constants";

/**
 * Wipes the entire Board, paged the same way the main wall's wipeArea is —
 * one bounded batch per call, well under Convex's per-call read cap. No
 * area filter (unlike wipeArea): a Board wipe is always "the whole thing,"
 * since Board is small enough that there's no meaningful "just this region."
 */
export const wipeAll = mutation({
  args: {
    passcode: v.string(),
    afterSequence: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      deletedCount: v.number(),
      done: v.boolean(),
      nextAfterSequence: v.number(),
    }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }

    const batch = await ctx.db
      .query("boardStrokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", args.afterSequence ?? 0))
      .order("asc")
      .take(BOARD_WIPE_BATCH_SIZE);

    let deletedCount = 0;
    for (const stroke of batch) {
      if (stroke.deleted) continue;
      const nextSequence = await claimNextSequence(ctx);
      await ctx.db.patch(stroke._id, { deleted: true, sequence: nextSequence });
      deletedCount++;
    }

    const done = batch.length < BOARD_WIPE_BATCH_SIZE;
    const nextAfterSequence = batch.length > 0 ? batch[batch.length - 1].sequence : args.afterSequence ?? 0;

    return { success: true as const, deletedCount, done, nextAfterSequence };
  },
});
