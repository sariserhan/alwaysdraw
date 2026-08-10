import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

const DEFAULT_ADMIN_PASSCODE = "alwaysdraw-admin-2026";

function verifyAdminPasscode(passcode: string) {
  const secretKey = process.env.ADMIN_SECRET_KEY || DEFAULT_ADMIN_PASSCODE;
  if (passcode !== secretKey) {
    throw new ConvexError("INVALID_ADMIN_PASSCODE: Unauthorized administrative operation.");
  }
}

/**
 * Moderation: Wipe all strokes inside a rectangular bounding box [minX, minY, maxX, maxY].
 */
export const wipeArea = mutation({
  args: {
    passcode: v.string(),
    minX: v.number(),
    minY: v.number(),
    maxX: v.number(),
    maxY: v.number(),
  },
  handler: async (ctx, args) => {
    verifyAdminPasscode(args.passcode);

    const strokes = await ctx.db.query("strokes").collect();
    let deletedCount = 0;

    for (const stroke of strokes) {
      // Check if any point in stroke falls inside bounding box
      const overlaps = stroke.points.some(
        (p) => p.x >= args.minX && p.x <= args.maxX && p.y >= args.minY && p.y <= args.maxY,
      );
      if (overlaps) {
        await ctx.db.delete(stroke._id);
        deletedCount++;
      }
    }

    return { success: true, deletedCount };
  },
});

/**
 * Moderation: Delete all strokes drawn by a specific client ID.
 */
export const rollbackClient = mutation({
  args: {
    passcode: v.string(),
    targetClientId: v.string(),
  },
  handler: async (ctx, args) => {
    verifyAdminPasscode(args.passcode);

    const strokes = await ctx.db.query("strokes").collect();
    let deletedCount = 0;

    for (const stroke of strokes) {
      if (stroke.clientId === args.targetClientId) {
        await ctx.db.delete(stroke._id);
        deletedCount++;
      }
    }

    return { success: true, deletedCount };
  },
});

/**
 * Operations: Publish a global live broadcast banner visible to all online painters.
 */
export const publishBroadcast = mutation({
  args: {
    passcode: v.string(),
    message: v.string(),
    author: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    verifyAdminPasscode(args.passcode);

    // Deactivate previous active broadcasts
    const activeBroadcasts = await ctx.db
      .query("broadcasts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    for (const b of activeBroadcasts) {
      await ctx.db.patch(b._id, { active: false });
    }

    // Insert new active broadcast
    await ctx.db.insert("broadcasts", {
      message: args.message,
      author: args.author || "ALWAYS_DRAW_ADMIN",
      active: true,
      createdTimestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Operations: Clear the current active broadcast banner.
 */
export const clearBroadcast = mutation({
  args: {
    passcode: v.string(),
  },
  handler: async (ctx, args) => {
    verifyAdminPasscode(args.passcode);

    const activeBroadcasts = await ctx.db
      .query("broadcasts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    for (const b of activeBroadcasts) {
      await ctx.db.patch(b._id, { active: false });
    }

    return { success: true };
  },
});

/**
 * Query: Fetch active global broadcast banner.
 */
export const getActiveBroadcast = query({
  args: {},
  handler: async (ctx) => {
    const broadcast = await ctx.db
      .query("broadcasts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    return broadcast ?? null;
  },
});

/**
 * Telemetry: Fetch system health metrics & statistics.
 */
export const getTelemetry = query({
  args: {
    passcode: v.string(),
  },
  handler: async (ctx, args) => {
    verifyAdminPasscode(args.passcode);

    const strokeCount = (await ctx.db.query("strokes").collect()).length;
    const presenceCount = (await ctx.db.query("presence").collect()).length;
    const snapshotCount = (await ctx.db.query("snapshots").collect()).length;
    const meta = await ctx.db.query("canvasMetadata").first();

    return {
      strokeCount,
      activePresenceCount: presenceCount,
      snapshotCount,
      currentSequence: meta?.currentSequence ?? 0,
      worldWidth: meta?.width ?? 20000,
      worldHeight: meta?.height ?? 20000,
    };
  },
});
