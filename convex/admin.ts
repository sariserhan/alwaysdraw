import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { consumeRateLimit } from "./abuse";
import { ADMIN_VERIFY_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS } from "./constants";

export function isPasscodeValid(passcode: string): boolean {
  const secretKey = process.env.ADMIN_SECRET_KEY;
  // No fallback to a hardcoded default — an unconfigured deployment should
  // have no working admin passcode, not a guessable one.
  if (!secretKey) return false;
  return passcode === secretKey;
}

// Every admin mutation routes through here, not just the pre-flight check —
// otherwise a client could skip verifyPasscode and brute-force a passcode
// directly against e.g. wipeArea instead.
export async function verifyAdminPasscode(ctx: MutationCtx, passcode: string) {
  await consumeRateLimit(ctx, "admin:verify:global", ADMIN_VERIFY_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);
  if (!isPasscodeValid(passcode)) {
    throw new ConvexError("INVALID_ADMIN_PASSCODE: Unauthorized administrative operation.");
  }
}

/**
 * Pre-flight verification query/mutation for admin credentials.
 */
export const verifyPasscode = mutation({
  args: { passcode: v.string() },
  handler: async (ctx, args) => {
    await consumeRateLimit(ctx, "admin:verify:global", ADMIN_VERIFY_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);
    return isPasscodeValid(args.passcode);
  },
});

/**
 * Moderation Action 1: Bounding-box area stroke purge (Wipe Area).
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
    await verifyAdminPasscode(ctx, args.passcode);

    const allStrokes = await ctx.db.query("strokes").collect();
    let deletedCount = 0;

    for (const stroke of allStrokes) {
      const isInside = stroke.points.some(
        (pt) => pt.x >= args.minX && pt.x <= args.maxX && pt.y >= args.minY && pt.y <= args.maxY,
      );

      if (isInside) {
        await ctx.db.delete(stroke._id);
        deletedCount++;
      }
    }

    return { success: true, deletedCount };
  },
});

/**
 * Moderation Action 2: Rollback all strokes drawn by a specific client ID.
 */
export const rollbackClient = mutation({
  args: {
    passcode: v.string(),
    targetClientId: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);

    const clientStrokes = await ctx.db
      .query("strokes")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.targetClientId))
      .collect();

    for (const stroke of clientStrokes) {
      await ctx.db.delete(stroke._id);
    }

    return { success: true, deletedCount: clientStrokes.length };
  },
});

/**
 * Moderation Action 3: Publish global broadcast message.
 */
export const publishBroadcast = mutation({
  args: {
    passcode: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);

    const activeList = await ctx.db
      .query("broadcasts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    for (const item of activeList) {
      await ctx.db.patch(item._id, { active: false });
    }

    await ctx.db.insert("broadcasts", {
      message: args.message,
      author: "ADMIN",
      active: true,
      createdTimestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Moderation Action 4: Clear global broadcast announcement.
 */
export const clearBroadcast = mutation({
  args: {
    passcode: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);

    const activeList = await ctx.db
      .query("broadcasts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    for (const item of activeList) {
      await ctx.db.patch(item._id, { active: false });
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
 * Protected Zones: Create a locked canvas region.
 */
export const createProtectedZone = mutation({
  args: {
    passcode: v.string(),
    name: v.string(),
    minX: v.number(),
    minY: v.number(),
    maxX: v.number(),
    maxY: v.number(),
  },
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);

    const zoneId = await ctx.db.insert("protectedZones", {
      name: args.name,
      minX: Math.min(args.minX, args.maxX),
      minY: Math.min(args.minY, args.maxY),
      maxX: Math.max(args.minX, args.maxX),
      maxY: Math.max(args.minY, args.maxY),
      createdAt: Date.now(),
    });

    return { success: true, zoneId };
  },
});

/**
 * Protected Zones: Remove a locked canvas region.
 */
export const deleteProtectedZone = mutation({
  args: {
    passcode: v.string(),
    zoneId: v.id("protectedZones"),
  },
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);
    await ctx.db.delete(args.zoneId);
    return { success: true };
  },
});

/**
 * Query: Get all active protected canvas zones.
 */
export const getProtectedZones = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("protectedZones").collect();
  },
});

/**
 * Telemetry: Fetch system health metrics & statistics. Safe query returns null on bad passcode.
 */
export const getTelemetry = query({
  args: {
    passcode: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isPasscodeValid(args.passcode)) {
      return null;
    }

    const strokeCount = (await ctx.db.query("strokes").collect()).length;
    const presenceCount = (await ctx.db.query("presence").collect()).length;
    const snapshotCount = (await ctx.db.query("snapshots").collect()).length;
    const protectedZoneCount = (await ctx.db.query("protectedZones").collect()).length;
    const meta = await ctx.db.query("canvasMetadata").first();

    return {
      strokeCount,
      activePresenceCount: presenceCount,
      snapshotCount,
      protectedZoneCount,
      currentSequence: meta?.currentSequence ?? 0,
    };
  },
});
