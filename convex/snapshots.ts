import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("snapshots")
      .withIndex("by_sequence")
      .order("desc")
      .first();

    return latest ?? null;
  },
});

export const submit = mutation({
  args: {
    sequence: v.number(),
    imageData: v.string(),
    strokeCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Basic validation
    if (args.imageData.length > 5 * 1024 * 1024) {
      throw new Error("Snapshot image payload exceeds 5MB limit");
    }
    if (args.sequence < 0) {
      throw new Error("Invalid snapshot sequence");
    }

    // Check if snapshot for this sequence already exists
    const existing = await ctx.db
      .query("snapshots")
      .withIndex("by_sequence", (q) => q.eq("sequence", args.sequence))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("snapshots", {
      sequence: args.sequence,
      imageData: args.imageData,
      strokeCount: args.strokeCount,
      createdAt: Date.now(),
    });

    return id;
  },
});
