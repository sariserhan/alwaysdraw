import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_STALE_MS,
  MAX_PRESENCE_LIST,
  MAX_LASER_TRAIL_POINTS,
  MAX_CLIENT_ID_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  HEARTBEATS_PER_CLIENT_WINDOW,
  HEARTBEATS_GLOBAL_WINDOW,
} from "./constants";
import {
  assertBoundedIdentifier,
  assertWritesEnabled,
  consumeRateLimit,
} from "./abuse";

// Cursor coordinates are just for rendering — clamp rather than reject.
function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

export const heartbeat = mutation({
  args: {
    clientId: v.string(),
    cursorX: v.number(),
    cursorY: v.number(),
    laserTrail: v.optional(
      v.array(
        v.object({
          x: v.number(),
          y: v.number(),
          timestamp: v.number(),
        }),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    await consumeRateLimit(
      ctx,
      `presence:client:${args.clientId}`,
      HEARTBEATS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(
      ctx,
      "presence:global",
      HEARTBEATS_GLOBAL_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    const cursorX = clamp(args.cursorX, WORLD_WIDTH);
    const cursorY = clamp(args.cursorY, WORLD_HEIGHT);
    // --- Abuse boundary: bound trail size like MAX_POINTS_PER_STROKE does for strokes ---
    if (
      args.laserTrail !== undefined &&
      args.laserTrail.length > MAX_LASER_TRAIL_POINTS
    ) {
      throw new Error(
        `laserTrail.length must not exceed ${MAX_LASER_TRAIL_POINTS}`,
      );
    }
    const now = Date.now();
    // Points are just for rendering — clamp x/y like cursorX/cursorY, and
    // clamp timestamp to now so a future/spoofed timestamp can't freeze the
    // decay-by-age render on every other client (see lib/laser.ts).
    const laserTrail = args.laserTrail?.map((p) => ({
      x: clamp(p.x, WORLD_WIDTH),
      y: clamp(p.y, WORLD_HEIGHT),
      timestamp: Number.isFinite(p.timestamp) ? Math.min(p.timestamp, now) : now,
    }));
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        cursorX,
        cursorY,
        laserTrail,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert("presence", {
        clientId: args.clientId,
        cursorX,
        cursorY,
        laserTrail,
        lastSeenAt: now,
      });
    }
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      clientId: v.string(),
      cursorX: v.number(),
      cursorY: v.number(),
      laserTrail: v.optional(
        v.array(
          v.object({
            x: v.number(),
            y: v.number(),
            timestamp: v.number(),
          }),
        ),
      ),
    }),
  ),
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_ONLINE_WINDOW_MS;
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", cutoff))
      .take(MAX_PRESENCE_LIST);
    return rows.map((r) => ({
      clientId: r.clientId,
      cursorX: r.cursorX,
      cursorY: r.cursorY,
      laserTrail: r.laserTrail,
    }));
  },
});

// O(1) read of the cron-maintained counter (see recomputeOnlineCount below)
// instead of collecting every online-window row on every call from every
// subscriber — that pattern re-ran and re-pushed to all subscribers on
// literally every heartbeat, an O(clients^2) reactivity cost as usage grows.
export const onlineCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const stats = await ctx.db.query("presenceStats").first();
    return stats?.onlineCount ?? 0;
  },
});

// Called by crons.ts every 1 minute; deletes rows not seen in 2 minutes.
export const clearStale = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_STALE_MS;
    const stale = await ctx.db
      .query("presence")
      .withIndex("by_lastSeenAt", (q) => q.lt("lastSeenAt", cutoff))
      .take(1000); // ponytail: bounded per-run batch; 1min cron cadence keeps backlog small
    for (const row of stale) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

// Called by crons.ts every 15s; the one place that still pays the O(n)
// row-collect cost, so the public onlineCount query doesn't have to.
export const recomputeOnlineCount = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_ONLINE_WINDOW_MS;
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", cutoff))
      .collect();
    const stats = await ctx.db.query("presenceStats").first();
    if (stats === null) {
      await ctx.db.insert("presenceStats", { onlineCount: rows.length, computedAt: Date.now() });
    } else {
      await ctx.db.patch(stats._id, { onlineCount: rows.length, computedAt: Date.now() });
    }
    return null;
  },
});
