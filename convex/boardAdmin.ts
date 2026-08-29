import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { verifyAdminPasscode } from "./admin";
import { claimNextSequence } from "./boardMetadata";
import { BOARD_WIPE_BATCH_SIZE, BOARD_PRUNE_BATCH_SIZE, BOARD_DELETED_STROKE_RETENTION_MS } from "./constants";

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
      await ctx.db.patch(stroke._id, { deleted: true, deletedAt: Date.now(), sequence: nextSequence });
      deletedCount++;
    }

    const done = batch.length < BOARD_WIPE_BATCH_SIZE;
    const nextAfterSequence = batch.length > 0 ? batch[batch.length - 1].sequence : args.afterSequence ?? 0;

    return { success: true as const, deletedCount, done, nextAfterSequence };
  },
});

export const getAutoPruneEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const meta = await ctx.db.query("boardMetadata").first();
    return meta?.autoPruneEnabled ?? false;
  },
});

export const setAutoPruneEnabled = mutation({
  args: { passcode: v.string(), enabled: v.boolean() },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }
    let meta = await ctx.db.query("boardMetadata").first();
    if (meta === null) {
      const id = await ctx.db.insert("boardMetadata", { currentSequence: 0, autoPruneEnabled: args.enabled });
      meta = await ctx.db.get(id);
    } else {
      await ctx.db.patch(meta._id, { autoPruneEnabled: args.enabled });
    }
    return { success: true as const };
  },
});

/**
 * Opt-in, off by default (see boardMetadata.autoPruneEnabled). The cron in
 * convex/crons.ts always fires on schedule — Convex crons are static,
 * deploy-time configuration with no runtime enable/disable — but this
 * handler's very first read decides whether it does anything at all.
 * When enabled, hard-deletes (not a patch) old soft-deleted boardStrokes
 * rows, bounded to one batch per call so a large backlog converges over
 * several cron runs instead of one unsafe unbounded pass.
 */
export const pruneDeletedStrokes = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const meta = await ctx.db.query("boardMetadata").first();
    if (!meta?.autoPruneEnabled) return null;

    const cutoff = Date.now() - BOARD_DELETED_STROKE_RETENTION_MS;
    // by_deleted_and_deletedAt, not by_sequence: wipeAll re-stamps a
    // soft-deleted row's sequence to a fresh, high value, so deleted rows
    // don't sit at the front of by_sequence with old live ones — a scan
    // from the oldest sequence would mostly re-read undeletable live rows
    // and rarely reach anything actually eligible for pruning. Filtering
    // on deletedAt (when the row was deleted), not serverTimestamp (when
    // the stroke was originally drawn), is also required for correctness:
    // wipeAll never touches serverTimestamp, so using it here would treat
    // an old stroke as immediately prunable the moment it's wiped,
    // defeating the retention window's entire purpose.
    const batch = await ctx.db
      .query("boardStrokes")
      .withIndex("by_deleted_and_deletedAt", (q) => q.eq("deleted", true).lt("deletedAt", cutoff))
      .take(BOARD_PRUNE_BATCH_SIZE);

    // Every row in batch already matches deleted===true && deletedAt<cutoff
    // by construction of the index query above — no further filtering needed.
    for (const stroke of batch) {
      await ctx.db.delete(stroke._id);
    }
    return null;
  },
});
