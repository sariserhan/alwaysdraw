import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  strokes: defineTable({
    clientStrokeId: v.string(),
    clientId: v.string(),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    color: v.string(),
    width: v.number(),
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

  presence: defineTable({
    clientId: v.string(),
    lastSeenAt: v.number(),
    cursorX: v.number(),
    cursorY: v.number(),
  })
    .index("by_clientId", ["clientId"])
    .index("by_lastSeenAt", ["lastSeenAt"]),
});
