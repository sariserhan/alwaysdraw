import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Never use a checkpoint old enough that its catch-up tombstones could have
// been pruned (retention is 24h). Keep old files briefly for in-flight readers.
export const CHECKPOINT_MAX_AGE_MS = 30 * 60_000;
const FILE_RETENTION_MS = 60 * 60_000;

export const latest = query({
  args: {},
  returns: v.union(v.null(), v.object({
    url: v.string(), sequence: v.number(), strokeCount: v.number(), bytes: v.number(), createdAt: v.number(),
  })),
  handler: async (ctx) => {
    const row = await ctx.db.query("wallCheckpoints").withIndex("by_createdAt").order("desc").first();
    if (!row || Date.now() - row.createdAt > CHECKPOINT_MAX_AGE_MS) return null;
    const url = await ctx.storage.getUrl(row.storageId);
    return url ? { url, sequence: row.sequence, strokeCount: row.strokeCount, bytes: row.bytes, createdAt: row.createdAt } : null;
  },
});

export const begin = internalMutation({
  args: { token: v.string(), sequence: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const state = await ctx.db.query("wallCheckpointJobs").first();
    if (state && now - state.startedAt < 10 * 60_000) return false;
    const latest = await ctx.db.query("wallCheckpoints").withIndex("by_createdAt").order("desc").first();
    if (latest && latest.sequence >= args.sequence) {
      // No edits since the last build: extend freshness without rebuilding.
      await ctx.db.patch(latest._id, { createdAt: now });
      return false;
    }
    if (state) await ctx.db.patch(state._id, { token: args.token, startedAt: now });
    else await ctx.db.insert("wallCheckpointJobs", { token: args.token, startedAt: now });
    return true;
  },
});

export const finish = internalMutation({
  args: {
    token: v.string(), sequence: v.number(), storageId: v.id("_storage"),
    strokeCount: v.number(), bytes: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { token, ...checkpoint }) => {
    const state = await ctx.db.query("wallCheckpointJobs").first();
    if (!state || state.token !== token) {
      await ctx.storage.delete(checkpoint.storageId);
      return null;
    }
    await ctx.db.insert("wallCheckpoints", { ...checkpoint, createdAt: Date.now() });
    await ctx.db.delete(state._id);
    return null;
  },
});

export const release = internalMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const state = await ctx.db.query("wallCheckpointJobs").first();
    if (state?.token === args.token) await ctx.db.delete(state._id);
    return null;
  },
});

export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const latest = await ctx.db.query("wallCheckpoints").withIndex("by_createdAt").order("desc").first();
    const old = await ctx.db.query("wallCheckpoints")
      .withIndex("by_createdAt", q => q.lt("createdAt", Date.now() - FILE_RETENTION_MS)).take(20);
    for (const row of old) {
      if (row._id === latest?._id) continue;
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }
    return null;
  },
});
