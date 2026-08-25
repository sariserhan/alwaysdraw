import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  PRESENCE_ONLINE_WINDOW_MS,
  MAX_PRESENCE_LIST,
  MAX_CLIENT_ID_LENGTH,
  MAX_USERNAME_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
  SKETCHBOOK_HEARTBEATS_PER_CLIENT_WINDOW,
  SKETCHBOOK_HEARTBEATS_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { containsProfanity } from "./profanity";
import { getSketchbookPage } from "../lib/sketchbookPages";

// Cursor coordinates are just for rendering — clamp to the page's own
// bounds rather than reject, same as the main canvas's presence.heartbeat.
function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

export const heartbeat = mutation({
  args: {
    clientId: v.string(),
    pageId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    cursorX: v.number(),
    cursorY: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    const page = getSketchbookPage(args.pageId);
    if (!page) {
      throw new Error(`unknown pageId: ${args.pageId}`);
    }
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
      `sketchbookPresence:client:${args.clientId}`,
      SKETCHBOOK_HEARTBEATS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "sketchbookPresence:global", SKETCHBOOK_HEARTBEATS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const cursorX = clamp(args.cursorX, page.width);
    const cursorY = clamp(args.cursorY, page.height);
    const now = Date.now();

    const existing = await ctx.db
      .query("sketchbookPresence")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        pageId: args.pageId,
        username: args.username,
        countryCode: args.countryCode,
        cursorX,
        cursorY,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert("sketchbookPresence", {
        clientId: args.clientId,
        pageId: args.pageId,
        username: args.username,
        countryCode: args.countryCode,
        cursorX,
        cursorY,
        lastSeenAt: now,
      });
    }
    return null;
  },
});

// ponytail: no stale-row cleanup cron (unlike the main canvas's
// presence.clearStale, run every minute via crons.ts) — a client that
// heartbeats then vanishes leaves one row behind forever. Fine while
// sketchbook usage stays small; upgrade path is the same clearStale
// pattern, scoped to this table, if stale rows become a real problem.
export const list = query({
  args: { pageId: v.string() },
  returns: v.array(
    v.object({
      clientId: v.string(),
      username: v.optional(v.string()),
      countryCode: v.optional(v.string()),
      cursorX: v.number(),
      cursorY: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!getSketchbookPage(args.pageId)) {
      throw new Error(`unknown pageId: ${args.pageId}`);
    }
    const cutoff = Date.now() - PRESENCE_ONLINE_WINDOW_MS;
    const rows = await ctx.db
      .query("sketchbookPresence")
      .withIndex("by_pageId_and_lastSeenAt", (q) => q.eq("pageId", args.pageId).gte("lastSeenAt", cutoff))
      .take(MAX_PRESENCE_LIST);
    return rows.map((r) => ({
      clientId: r.clientId,
      username: r.username,
      countryCode: r.countryCode,
      cursorX: r.cursorX,
      cursorY: r.cursorY,
    }));
  },
});
