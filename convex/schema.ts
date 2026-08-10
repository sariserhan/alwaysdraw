import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { BRUSH_TYPES } from "./constants";

const brushTypeValidator = v.union(...BRUSH_TYPES.map((t) => v.literal(t)));

export default defineSchema({
  strokes: defineTable({
    clientStrokeId: v.string(),
    clientId: v.string(),
    // Author display fields are a snapshot at draw time, not a live pointer
    // to a profile — renaming later doesn't rewrite the attribution on past
    // strokes, same as a signature.
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    brushType: v.optional(brushTypeValidator),
    color: v.string(),
    width: v.number(),
    opacity: v.optional(v.number()),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
    tiles: v.optional(v.array(v.string())),
    clientTimestamp: v.number(),
    sequence: v.number(),
    serverTimestamp: v.number(),
  })
    .index("by_sequence", ["sequence"])
    .index("by_clientStrokeId", ["clientStrokeId"]),

  canvasMetadata: defineTable({
    currentSequence: v.number(),
    width: v.number(),
    height: v.number(),
  }),

  rateLimits: defineTable({
    key: v.string(),
    windowStartedAt: v.number(),
    count: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_windowStartedAt", ["windowStartedAt"]),

  presence: defineTable({
    clientId: v.string(),
    lastSeenAt: v.number(),
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
  })
    .index("by_clientId", ["clientId"])
    .index("by_lastSeenAt", ["lastSeenAt"]),

  presenceStats: defineTable({
    onlineCount: v.number(),
    computedAt: v.number(),
  }),

  snapshots: defineTable({
    sequence: v.number(),
    imageData: v.string(),
    strokeCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_sequence", ["sequence"])
    .index("by_createdAt", ["createdAt"]),

  bookmarks: defineTable({
    title: v.string(),
    x: v.number(),
    y: v.number(),
    zoom: v.number(),
    clientId: v.string(),
    createdAt: v.number(),
    // Denormalized so the gallery can rank/display without an aggregation
    // query per bookmark. Optional for backward compat with bookmarks saved
    // before voting/comments existed — missing means 0, not unset.
    voteCount: v.optional(v.number()),
    commentCount: v.optional(v.number()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_clientId", ["clientId"])
    .index("by_voteCount", ["voteCount"]),

  // One row per (bookmark, client) vote — the uniqueness boundary that keeps
  // a vote toggleable and un-spoofable-by-refresh, since clientId is all the
  // identity this app has.
  bookmarkVotes: defineTable({
    bookmarkId: v.id("bookmarks"),
    clientId: v.string(),
    createdAt: v.number(),
  })
    .index("by_bookmark", ["bookmarkId"])
    .index("by_bookmark_and_client", ["bookmarkId", "clientId"]),

  bookmarkComments: defineTable({
    bookmarkId: v.id("bookmarks"),
    clientId: v.string(),
    username: v.optional(v.string()),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_bookmark", ["bookmarkId"]),

  broadcasts: defineTable({
    message: v.string(),
    author: v.string(),
    active: v.boolean(),
    createdTimestamp: v.number(),
  }).index("by_active", ["active"]),

  protectedZones: defineTable({
    name: v.string(),
    minX: v.number(),
    minY: v.number(),
    maxX: v.number(),
    maxY: v.number(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),
});
