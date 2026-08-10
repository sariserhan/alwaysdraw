import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_STALE_MS,
  MAX_PRESENCE_LIST,
} from "./constants";

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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cursorX = clamp(args.cursorX, WORLD_WIDTH);
    const cursorY = clamp(args.cursorY, WORLD_HEIGHT);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        cursorX,
        cursorY,
        lastSeenAt: Date.now(),
      });
    } else {
      await ctx.db.insert("presence", {
        clientId: args.clientId,
        cursorX,
        cursorY,
        lastSeenAt: Date.now(),
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
    }));
  },
});

export const onlineCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // ponytail: .collect() here is bounded by concurrent online clients (30s
    // window, stale rows swept every 1min by crons.ts), not by table growth.
    // No .count() exists on the query builder; revisit with a counter doc if
    // concurrent users ever gets large enough for this to matter.
    const cutoff = Date.now() - PRESENCE_ONLINE_WINDOW_MS;
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", cutoff))
      .collect();
    return rows.length;
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
