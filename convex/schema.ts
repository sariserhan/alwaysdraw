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
    // Soft-delete, not a real row delete: admin purges patch this to true
    // AND bump `sequence` to a fresh value instead of calling ctx.db.delete.
    // The client's incremental sync (listSince/live-tail, keyed off
    // increasing sequence numbers) only ever learns about *new* sequence
    // numbers — a hard delete has no new sequence number to announce
    // itself with, so it would never reach already-connected clients. A
    // patch does, making deletion reactive for everyone through the exact
    // same sync path new strokes already use, not just the admin who acted.
    deleted: v.optional(v.boolean()),
  })
    .index("by_sequence", ["sequence"])
    .index("by_clientStrokeId", ["clientStrokeId"])
    .index("by_clientId", ["clientId"]),

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

  // Sticky notes/pins dropped directly on the canvas at a world point —
  // distinct from bookmarkComments, which discuss a saved bookmarked view.
  // Single-level only: no threaded replies or @mentions yet (see the
  // "comment" tool pointer-down handler for why that's a deliberate cut).
  canvasComments: defineTable({
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    text: v.string(),
    x: v.number(),
    y: v.number(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

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
    // Stand-in for a real user account until login ships — clientId is the
    // app's existing per-browser identifier (see rate limiting/rollback).
    // The owning client is exempted from this zone's draw block.
    ownerClientId: v.optional(v.string()),
    ownerName: v.optional(v.string()),
  }).index("by_createdAt", ["createdAt"]),

  // User-facing "flag this" reports, reviewed by an admin. Two shapes share
  // one table rather than splitting into commentReports/areaReports: they're
  // reviewed through the same queue and the branching is a single field.
  contentReports: defineTable({
    reporterId: v.string(),
    targetType: v.union(v.literal("area"), v.literal("comment")),
    // "area" reports capture either a single camera position (quick "report
    // what I'm looking at") or a drag-marked rectangle (precise "report
    // exactly this") — minX/minY/maxX/maxY are set only for the latter.
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    zoom: v.optional(v.number()),
    minX: v.optional(v.number()),
    minY: v.optional(v.number()),
    maxX: v.optional(v.number()),
    maxY: v.optional(v.number()),
    // "comment" reports point at a specific canvasComments row.
    commentId: v.optional(v.id("canvasComments")),
    reason: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed")),
    createdAt: v.number(),
  })
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_reporter", ["reporterId"]),
});
