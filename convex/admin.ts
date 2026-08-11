import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { consumeRateLimit } from "./abuse";
import { ADMIN_VERIFY_GLOBAL_WINDOW, MAX_PROTECTED_ZONES, RATE_LIMIT_WINDOW_MS } from "./constants";
import { claimNextSequence } from "./canvasMetadata";

// Convex caps reads at 4096 per function execution. Scanning the whole
// strokes table in one call (as this used to) blew past that once the
// canvas had accumulated enough strokes — this keeps each call well under
// the cap; the client pages through with afterSequence/done (see
// components/AdminPanelModal.tsx's handleWipeArea).
const PURGE_BATCH_SIZE = 500;

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
    // Paged: each call scans one batch starting after this stroke sequence
    // number, well under Convex's 4096-reads-per-call cap. Omit on the
    // first call; pass back nextAfterSequence from the previous response
    // until done is true. See AdminPanelModal's handleWipeArea.
    afterSequence: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    deletedCount: v.number(),
    done: v.boolean(),
    nextAfterSequence: v.number(),
  }),
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);

    const batch = await ctx.db
      .query("strokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", args.afterSequence ?? 0))
      .order("asc")
      .take(PURGE_BATCH_SIZE);

    let deletedCount = 0;
    for (const stroke of batch) {
      if (stroke.deleted) continue;
      const isInside = stroke.points.some(
        (pt) => pt.x >= args.minX && pt.x <= args.maxX && pt.y >= args.minY && pt.y <= args.maxY,
      );
      if (isInside) {
        // Soft-delete with a freshly-claimed sequence number, not a real
        // row delete — see the schema comment on strokes.deleted for why:
        // this is what makes the deletion show up reactively for every
        // connected client's incremental sync, not just the admin who did it.
        const nextSequence = await claimNextSequence(ctx);
        await ctx.db.patch(stroke._id, { deleted: true, sequence: nextSequence });
        deletedCount++;
      }
    }

    const done = batch.length < PURGE_BATCH_SIZE;
    const nextAfterSequence = batch.length > 0 ? batch[batch.length - 1].sequence : args.afterSequence ?? 0;

    return { success: true, deletedCount, done, nextAfterSequence };
  },
});

/**
 * Moderation Action 2: Rollback all strokes drawn by a specific client ID.
 * Paged the same way as wipeArea, for the same reason (a client with many
 * strokes could otherwise exceed the per-call read cap) — the client loops
 * on `done` (see components/AdminPanelModal.tsx's handleRollbackClient).
 */
export const rollbackClient = mutation({
  args: {
    passcode: v.string(),
    targetClientId: v.string(),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    deletedCount: v.number(),
    done: v.boolean(),
    nextCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);

    const result = await ctx.db
      .query("strokes")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.targetClientId))
      .paginate({ numItems: PURGE_BATCH_SIZE, cursor: args.cursor ?? null });

    let deletedCount = 0;
    for (const stroke of result.page) {
      if (stroke.deleted) continue;
      const nextSequence = await claimNextSequence(ctx);
      await ctx.db.patch(stroke._id, { deleted: true, sequence: nextSequence });
      deletedCount++;
    }

    return { success: true, deletedCount, done: result.isDone, nextCursor: result.continueCursor };
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
    ownerClientId: v.optional(v.string()),
    ownerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);

    const existingZones = await ctx.db.query("protectedZones").take(MAX_PROTECTED_ZONES);
    if (existingZones.length >= MAX_PROTECTED_ZONES) {
      throw new ConvexError(
        `Cannot create more than ${MAX_PROTECTED_ZONES} protected zones — every stroke checks all of them, so this cap keeps that check cheap. Delete an unused zone first.`,
      );
    }

    const zoneId = await ctx.db.insert("protectedZones", {
      name: args.name,
      minX: Math.min(args.minX, args.maxX),
      minY: Math.min(args.minY, args.maxY),
      maxX: Math.max(args.minX, args.maxX),
      maxY: Math.max(args.minY, args.maxY),
      createdAt: Date.now(),
      ownerClientId: args.ownerClientId || undefined,
      ownerName: args.ownerName || undefined,
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
 * Query: Get all active protected canvas zones. `ownerClientId` is the exact
 * spoofable value (see lib/identity.ts) that exempts a client from a zone's
 * draw block, so it's stripped for non-admin callers — otherwise it'd be
 * readable straight off the wire regardless of what the UI renders, handing
 * out the bypass to anyone with devtools open.
 */
export const getProtectedZones = query({
  args: { passcode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const zones = await ctx.db.query("protectedZones").take(MAX_PROTECTED_ZONES);
    const isAdmin = args.passcode !== undefined && isPasscodeValid(args.passcode);
    return zones.map((zone) => ({
      ...zone,
      ownerClientId: isAdmin ? zone.ownerClientId : undefined,
    }));
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

    // strokeCount/activePresenceCount are approximate, not live row counts —
    // collect()-ing the strokes/presence tables just to count them would read
    // every row on every admin panel open, and only gets more expensive as
    // the wall grows. currentSequence is already a cheap O(1) singleton read
    // and a close proxy for stroke activity (every insert AND every
    // soft-delete tombstone claims a fresh one, so it modestly overcounts
    // live rows); presenceStats.onlineCount is the same cron-maintained
    // counter presence.onlineCount itself serves, already paying this cost
    // exactly once every 15s regardless of how many clients ask.
    const meta = await ctx.db.query("canvasMetadata").first();
    const presenceStats = await ctx.db.query("presenceStats").first();
    const snapshotCount = (await ctx.db.query("snapshots").take(1000)).length;
    const protectedZoneCount = (await ctx.db.query("protectedZones").take(MAX_PROTECTED_ZONES)).length;

    return {
      strokeCount: meta?.currentSequence ?? 0,
      activePresenceCount: presenceStats?.onlineCount ?? 0,
      snapshotCount,
      protectedZoneCount,
      currentSequence: meta?.currentSequence ?? 0,
    };
  },
});
