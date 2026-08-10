import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { BRUSH_TYPES } from "./constants";

const brushTypeValidator = v.union(...BRUSH_TYPES.map((t) => v.literal(t)));

export default defineSchema({
  strokes: defineTable({
    clientStrokeId: v.string(),
    clientId: v.string(),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    // Only meaningful when mode === "draw"; erase strokes carry no texture.
    // Optional so pre-existing rows (recorded before brushes existed) still
    // validate — callers default a missing brushType to "brush" on render.
    brushType: v.optional(brushTypeValidator),
    color: v.string(),
    width: v.number(),
    // Optional so pre-opacity rows still validate; missing means 1 (opaque).
    opacity: v.optional(v.number()),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
    // Spatial tile partitioning: array of 500x500 tile IDs (e.g. ["tile_4_8"]) spanned by this stroke
    tiles: v.optional(v.array(v.string())),
    clientTimestamp: v.number(),
    sequence: v.number(),
    serverTimestamp: v.number(),
  })
    // Hot path: fetch strokes in global sequence order (initial load + live tail).
    .index("by_sequence", ["sequence"])
    // Idempotent-insert check on retry.
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
  })
    .index("by_clientId", ["clientId"])
    .index("by_lastSeenAt", ["lastSeenAt"]),

  // Singleton, recomputed on a cron (see crons.ts) so the public onlineCount
  // query is an O(1) single-doc read instead of collecting every presence
  // row within the online window on every call from every subscriber.
  presenceStats: defineTable({
    onlineCount: v.number(),
    computedAt: v.number(),
  }),

  // Canvas Snapshots: flattened rendered bitmaps at specific sequence checkpoints.
  // Enables instant initial page load + delta stroke catch-up without replaying
  // millions of individual strokes.
  snapshots: defineTable({
    sequence: v.number(),
    imageData: v.string(), // Data URL (image/webp or image/png)
    strokeCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_sequence", ["sequence"])
    .index("by_createdAt", ["createdAt"]),

  // Bookmarks: Saved favorite locations with labels and coordinates (x, y, zoom).
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
});
