import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BOARD_HEARTBEATS_PER_CLIENT_WINDOW,
  BOARD_HEARTBEATS_GLOBAL_WINDOW,
  BOARD_MAX_PRESENCE_LIST,
  PRESENCE_ONLINE_WINDOW_MS,
  MAX_LASER_TRAIL_POINTS,
  MAX_CLIENT_ID_LENGTH,
  MAX_USERNAME_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  COUNTRY_CODE_PATTERN,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { containsProfanity } from "./profanity";

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

export const heartbeat = mutation({
  args: {
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    cursorX: v.number(),
    cursorY: v.number(),
    laserTrail: v.optional(
      v.array(v.object({ x: v.number(), y: v.number(), timestamp: v.number() })),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
      if (containsProfanity(args.username)) {
        throw new ConvexError("PROFANITY_BLOCKED: username contains a blocked word — please choose another");
      }
    }
    if (args.countryCode !== undefined && !COUNTRY_CODE_PATTERN.test(args.countryCode)) {
      throw new Error("countryCode must be a 2-letter ISO 3166-1 alpha-2 code");
    }
    await consumeRateLimit(
      ctx,
      `boardPresence:client:${args.clientId}`,
      BOARD_HEARTBEATS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "boardPresence:global", BOARD_HEARTBEATS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const cursorX = clamp(args.cursorX, BOARD_WIDTH);
    const cursorY = clamp(args.cursorY, BOARD_HEIGHT);
    if (args.laserTrail !== undefined && args.laserTrail.length > MAX_LASER_TRAIL_POINTS) {
      throw new Error(`laserTrail.length must not exceed ${MAX_LASER_TRAIL_POINTS}`);
    }
    const now = Date.now();
    const laserTrail = args.laserTrail?.map((p) => ({
      x: clamp(p.x, BOARD_WIDTH),
      y: clamp(p.y, BOARD_HEIGHT),
      timestamp: Number.isFinite(p.timestamp) ? Math.min(p.timestamp, now) : now,
    }));

    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        username: args.username,
        countryCode: args.countryCode,
        cursorX,
        cursorY,
        laserTrail,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert("boardPresence", {
        clientId: args.clientId,
        username: args.username,
        countryCode: args.countryCode,
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
      username: v.optional(v.string()),
      countryCode: v.optional(v.string()),
      cursorX: v.number(),
      cursorY: v.number(),
      laserTrail: v.optional(
        v.array(v.object({ x: v.number(), y: v.number(), timestamp: v.number() })),
      ),
    }),
  ),
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_ONLINE_WINDOW_MS;
    const rows = await ctx.db
      .query("boardPresence")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", cutoff))
      .take(BOARD_MAX_PRESENCE_LIST);
    return rows.map((r) => ({
      clientId: r.clientId,
      username: r.username,
      countryCode: r.countryCode,
      cursorX: r.cursorX,
      cursorY: r.cursorY,
      laserTrail: r.laserTrail,
    }));
  },
});
