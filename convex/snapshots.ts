import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { RATE_LIMIT_WINDOW_MS, SNAPSHOTS_GLOBAL_WINDOW, MAX_SNAPSHOT_IMAGE_BYTES } from "./constants";
import { assertWritesEnabled, consumeRateLimit } from "./abuse";

const IMAGE_DATA_URL_PATTERN = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

const snapshotReturnFields = v.object({
  _id: v.id("snapshots"),
  _creationTime: v.number(),
  sequence: v.number(),
  imageData: v.string(),
  strokeCount: v.number(),
  createdAt: v.number(),
});

export const getLatest = query({
  args: {},
  returns: v.union(snapshotReturnFields, v.null()),
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
  returns: v.id("snapshots"),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    await consumeRateLimit(ctx, "snapshots:global", SNAPSHOTS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    if (args.imageData.length > MAX_SNAPSHOT_IMAGE_BYTES) {
      throw new Error("snapshot image payload exceeds the size limit");
    }
    if (!IMAGE_DATA_URL_PATTERN.test(args.imageData)) {
      throw new Error("imageData must be a base64 data: URL (png/webp/jpeg)");
    }
    if (!Number.isFinite(args.sequence) || args.sequence < 0) {
      throw new Error("sequence must be a non-negative number");
    }
    if (!Number.isFinite(args.strokeCount) || args.strokeCount < 0) {
      throw new Error("strokeCount must be a non-negative number");
    }

    const existing = await ctx.db
      .query("snapshots")
      .withIndex("by_sequence", (q) => q.eq("sequence", args.sequence))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("snapshots", {
      sequence: args.sequence,
      imageData: args.imageData,
      strokeCount: args.strokeCount,
      createdAt: Date.now(),
    });
  },
});
