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
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_clientId", ["clientId"]),

  broadcasts: defineTable({
    message: v.string(),
    author: v.string(),
    active: v.boolean(),
    createdTimestamp: v.number(),
  }).index("by_active", ["active"]),
});
