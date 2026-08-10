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
});
