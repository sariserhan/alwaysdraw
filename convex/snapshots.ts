import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  RATE_LIMIT_WINDOW_MS,
  SNAPSHOTS_GLOBAL_WINDOW,
  MAX_SNAPSHOT_IMAGE_BYTES,
  SNAPSHOTS_TO_KEEP,
} from "./constants";
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

    // ConvexError, not plain Error — Convex redacts plain Error messages to
    // a generic "Server Error" in production (see abuse.ts's identical
    // convention), which made every rejection below indistinguishable from
    // every other one, and from a genuine crash, in prod logs.
    if (args.imageData.length > MAX_SNAPSHOT_IMAGE_BYTES) {
      throw new ConvexError("snapshot image payload exceeds the size limit");
    }
    if (!IMAGE_DATA_URL_PATTERN.test(args.imageData)) {
      throw new ConvexError("imageData must be a base64 data: URL (png/webp/jpeg)");
    }
    if (!Number.isFinite(args.sequence) || args.sequence < 0) {
      throw new ConvexError("sequence must be a non-negative number");
    }
    if (!Number.isFinite(args.strokeCount) || args.strokeCount < 0) {
      throw new ConvexError("strokeCount must be a non-negative number");
    }
    // A snapshot claiming a sequence beyond what's actually happened would
    // make every future client's replay resume from a point with no real
    // strokes past it — silently and permanently hiding all real content
    // for every new visitor, with no way to undo it from the UI. The only
    // legitimate sequence values are ones the wall has actually reached.
    // Expected to trip occasionally under real concurrent traffic — a
    // client's locally-tracked sequence can briefly outrun canvasMetadata's
    // committed value — not necessarily a bug when it fires.
    const metadata = await ctx.db.query("canvasMetadata").first();
    const currentSequence = metadata?.currentSequence ?? 0;
    if (args.sequence > currentSequence) {
      throw new ConvexError("sequence cannot exceed the wall's current sequence");
    }

    const existing = await ctx.db
      .query("snapshots")
      .withIndex("by_sequence", (q) => q.eq("sequence", args.sequence))
      .first();

    if (existing) {
      return existing._id;
    }

    const inserted = await ctx.db.insert("snapshots", {
      sequence: args.sequence,
      imageData: args.imageData,
      strokeCount: args.strokeCount,
      createdAt: Date.now(),
    });

    const overflow = await ctx.db
      .query("snapshots")
      .withIndex("by_sequence")
      .order("desc")
      .collect();
    for (const row of overflow.slice(SNAPSHOTS_TO_KEEP)) {
      await ctx.db.delete(row._id);
    }

    return inserted;
  },
});
