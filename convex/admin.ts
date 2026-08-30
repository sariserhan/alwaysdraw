import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { consumeRateLimit, tryConsumeRateLimit } from "./abuse";
import {
  ADMIN_VERIFY_GLOBAL_WINDOW,
  ADMIN_FAILED_VERIFY_WINDOW,
  ADMIN_FAILED_VERIFY_WINDOW_MS,
  MAX_PROTECTED_ZONES,
  RATE_LIMIT_WINDOW_MS,
  MAX_BROADCAST_MESSAGE_LENGTH,
  MAX_ZONE_NAME_LENGTH,
  MAX_CLIENT_ID_LENGTH,
  SNAPSHOTS_TO_KEEP,
  DELETED_STROKE_RETENTION_MS,
  PRUNE_BATCH_SIZE as HARD_DELETE_PRUNE_BATCH_SIZE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "./constants";
import { claimNextSequence } from "./canvasMetadata";

// Convex caps reads at 4096 per function execution. Scanning the whole
// strokes table in one call (as this used to) blew past that once the
// canvas had accumulated enough strokes — this keeps each call well under
// the cap; the client pages through with afterSequence/done (see
// components/AdminPanelModal.tsx's handleWipeArea).
const PURGE_BATCH_SIZE = 500;

// `===` short-circuits on the first mismatched character, so how long a
// guess takes to reject leaks how many leading characters it got right —
// a real (if slow) side channel stacked on top of the deliberately tight
// admin:verify:global rate limit below. Always walks the full length
// instead. Doesn't protect the length itself, same as every standard
// timing-safe-equal implementation (Node's crypto.timingSafeEqual requires
// equal-length inputs for the same reason) — length isn't the secret here.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function isPasscodeValid(passcode: string): boolean {
  const secretKey = process.env.ADMIN_SECRET_KEY;
  // No fallback to a hardcoded default — an unconfigured deployment should
  // have no working admin passcode, not a guessable one.
  if (!secretKey) return false;
  return timingSafeEqual(passcode, secretKey);
}

// Every admin mutation routes through here, not just the pre-flight check —
// otherwise a client could skip verifyPasscode and brute-force a passcode
// directly against e.g. wipeArea instead.
//
// Returns a result instead of throwing — deliberately. A Convex mutation's
// writes are ALL discarded together if the mutation ultimately throws, no
// matter how deep the write happened (see tryConsumeRateLimit's doc comment
// in abuse.ts for the full explanation, plus an empirical confirmation).
// "Consume the failed-guess budget, then throw to reject the request" can
// therefore never make that consumption durable — every caller MUST return
// `{ ok: false }` as a normal value (never re-throw it) or the two rate
// limits below silently stop being enforced against wrong-passcode callers.
export async function verifyAdminPasscode(
  ctx: MutationCtx,
  passcode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Correct passcode short-circuits before either rate limit below — both
  // exist to slow down someone *guessing* the passcode, not to cap how much
  // an admin who already has it can do. Checking validity first means a
  // real admin's own bulk operations (wipeArea/rollbackClient's paginated
  // batches, each re-verifying) are never throttled, no matter how many
  // calls one operation needs.
  if (isPasscodeValid(passcode)) {
    return { ok: true };
  }
  const generalOk = await tryConsumeRateLimit(
    ctx,
    "admin:verify:global",
    ADMIN_VERIFY_GLOBAL_WINDOW,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!generalOk) {
    return { ok: false, error: "ADMIN_RATE_LIMITED: Too many admin requests — try again shortly." };
  }
  // A separate, much stricter budget than the general one above — this is
  // the actual brute-force defense, independent of the general per-10s cap.
  const failedOk = await tryConsumeRateLimit(
    ctx,
    "admin:verify:failed:global",
    ADMIN_FAILED_VERIFY_WINDOW,
    ADMIN_FAILED_VERIFY_WINDOW_MS,
  );
  if (!failedOk) {
    return {
      ok: false,
      error: "ADMIN_RATE_LIMITED: Too many incorrect passcode attempts — try again in a minute.",
    };
  }
  return { ok: false, error: "INVALID_ADMIN_PASSCODE: Unauthorized administrative operation." };
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
        await ctx.db.patch(stroke._id, { deleted: true, deletedAt: Date.now(), sequence: nextSequence });
        deletedCount++;
      }
    }

    const done = batch.length < PURGE_BATCH_SIZE;
    const nextAfterSequence = batch.length > 0 ? batch[batch.length - 1].sequence : args.afterSequence ?? 0;

    return { success: true as const, deletedCount, done, nextAfterSequence };
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
  returns: v.union(
    v.object({
      success: v.literal(true),
      deletedCount: v.number(),
      done: v.boolean(),
      nextCursor: v.union(v.string(), v.null()),
    }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }

    const result = await ctx.db
      .query("strokes")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.targetClientId))
      .paginate({ numItems: PURGE_BATCH_SIZE, cursor: args.cursor ?? null });

    let deletedCount = 0;
    for (const stroke of result.page) {
      if (stroke.deleted) continue;
      const nextSequence = await claimNextSequence(ctx);
      await ctx.db.patch(stroke._id, { deleted: true, deletedAt: Date.now(), sequence: nextSequence });
      deletedCount++;
    }

    return { success: true as const, deletedCount, done: result.isDone, nextCursor: result.continueCursor };
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
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }
    if (args.message.length === 0 || args.message.length > MAX_BROADCAST_MESSAGE_LENGTH) {
      throw new Error(`message must be between 1 and ${MAX_BROADCAST_MESSAGE_LENGTH} characters`);
    }

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

    return { success: true as const };
  },
});

/**
 * Moderation Action 4: Clear global broadcast announcement.
 */
export const clearBroadcast = mutation({
  args: {
    passcode: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }

    const activeList = await ctx.db
      .query("broadcasts")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    for (const item of activeList) {
      await ctx.db.patch(item._id, { active: false });
    }

    return { success: true as const };
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
  returns: v.union(
    v.object({ success: v.literal(true), zoneId: v.id("protectedZones") }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }
    if (args.name.length === 0 || args.name.length > MAX_ZONE_NAME_LENGTH) {
      throw new Error(`name must be between 1 and ${MAX_ZONE_NAME_LENGTH} characters`);
    }
    if (args.ownerName !== undefined && args.ownerName.length > MAX_ZONE_NAME_LENGTH) {
      throw new Error(`ownerName must not exceed ${MAX_ZONE_NAME_LENGTH} characters`);
    }
    if (args.ownerClientId !== undefined && args.ownerClientId.length > MAX_CLIENT_ID_LENGTH) {
      throw new Error(`ownerClientId must not exceed ${MAX_CLIENT_ID_LENGTH} characters`);
    }

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

    return { success: true as const, zoneId };
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
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }
    await ctx.db.delete(args.zoneId);
    return { success: true as const };
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
    // Was `.take(1000)` — each row can carry up to MAX_SNAPSHOT_IMAGE_BYTES
    // (5MB) of base64 image data, and Convex charges for actual document
    // bytes read regardless of which fields the code touches afterward, so
    // that one line could read up to ~5GB per call. snapshots.submit prunes
    // to SNAPSHOTS_TO_KEEP now, so the table should never realistically
    // exceed that — bounding the read here to match turns this from "read
    // up to 1000 multi-MB rows to produce a number" into a genuinely cheap,
    // still-accurate count. The +1 only shows up as a stale overcount in
    // the moment between a submit's insert and its own pruning pass.
    const snapshotCount = (await ctx.db.query("snapshots").take(SNAPSHOTS_TO_KEEP + 1)).length;
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

export const getAutoPruneEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const meta = await ctx.db.query("canvasMetadata").first();
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
    const meta = await ctx.db.query("canvasMetadata").first();
    if (meta === null) {
      // canvasMetadata is a singleton seeded elsewhere (claimNextSequence) —
      // reaching this branch would mean toggling the setting before the
      // wall has ever been drawn on or metadata otherwise initialized. Kept
      // as a safe fallback matching boardAdmin's setAutoPruneEnabled, not
      // expected to actually fire in a running deployment.
      await ctx.db.insert("canvasMetadata", {
        currentSequence: 0,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        autoPruneEnabled: args.enabled,
      });
    } else {
      await ctx.db.patch(meta._id, { autoPruneEnabled: args.enabled });
    }
    return { success: true as const };
  },
});

/**
 * Opt-in, off by default (see canvasMetadata.autoPruneEnabled). The cron in
 * convex/crons.ts always fires on schedule — this handler's very first read
 * decides whether it does anything at all. When enabled, hard-deletes (not
 * a patch) old soft-deleted strokes rows, bounded to one batch per call so
 * a large backlog converges over several cron runs instead of one unsafe
 * unbounded pass. Mirrors boardAdmin.pruneDeletedStrokes exactly.
 */
export const pruneDeletedStrokes = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const meta = await ctx.db.query("canvasMetadata").first();
    if (!meta?.autoPruneEnabled) return null;

    const cutoff = Date.now() - DELETED_STROKE_RETENTION_MS;
    // by_deleted_and_deletedAt, not by_sequence: wipeArea/rollbackClient
    // re-stamp a soft-deleted row's sequence to a fresh, high value, so
    // deleted rows don't sit at the front of by_sequence with old live
    // ones — a scan from the oldest sequence would mostly re-read
    // undeletable live rows and rarely reach anything actually eligible for
    // pruning. Filtering on deletedAt (when the row was deleted), not
    // serverTimestamp (when the stroke was originally drawn), is also
    // required for correctness: neither soft-delete site touches
    // serverTimestamp, so using it here would treat an old stroke as
    // immediately prunable the moment it's wiped, defeating the retention
    // window's entire purpose.
    const batch = await ctx.db
      .query("strokes")
      .withIndex("by_deleted_and_deletedAt", (q) => q.eq("deleted", true).lt("deletedAt", cutoff))
      .take(HARD_DELETE_PRUNE_BATCH_SIZE);

    // Every row in batch already matches deleted===true && deletedAt<cutoff
    // by construction of the index query above — no further filtering needed.
    for (const stroke of batch) {
      await ctx.db.delete(stroke._id);
    }
    return null;
  },
});
