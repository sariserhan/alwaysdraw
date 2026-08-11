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
    // A snapshot claiming a sequence beyond what's actually happened would
    // make every future client's replay resume from a point with no real
    // strokes past it — silently and permanently hiding all real content
    // for every new visitor, with no way to undo it from the UI. The only
    // legitimate sequence values are ones the wall has actually reached.
    const metadata = await ctx.db.query("canvasMetadata").first();
    const currentSequence = metadata?.currentSequence ?? 0;
    if (args.sequence > currentSequence) {
      throw new Error("sequence cannot exceed the wall's current sequence");
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
