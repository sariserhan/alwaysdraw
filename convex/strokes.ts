import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MIN_BRUSH_WIDTH,
  MAX_BRUSH_WIDTH,
  MIN_OPACITY,
  MAX_OPACITY,
  MIN_POINTS_PER_STROKE,
  MAX_POINTS_PER_STROKE,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  COLOR_PATTERN,
  BRUSH_TYPES,
  MAX_CLIENT_ID_LENGTH,
  MAX_CLIENT_STROKE_ID_LENGTH,
  MAX_COLOR_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  STROKES_PER_CLIENT_WINDOW,
  STROKES_GLOBAL_WINDOW,
} from "./constants";
import {
  assertBoundedIdentifier,
  assertWritesEnabled,
  consumeRateLimit,
} from "./abuse";

const pointValidator = v.object({ x: v.number(), y: v.number() });
const brushTypeValidator = v.union(...BRUSH_TYPES.map((t) => v.literal(t)));

const strokeReturnFields = v.object({
  _id: v.id("strokes"),
  _creationTime: v.number(),
  clientStrokeId: v.string(),
  clientId: v.string(),
  mode: v.union(v.literal("draw"), v.literal("erase")),
  brushType: v.optional(brushTypeValidator),
  color: v.string(),
  width: v.number(),
  opacity: v.optional(v.number()),
  points: v.array(pointValidator),
  clientTimestamp: v.number(),
  sequence: v.number(),
  serverTimestamp: v.number(),
});

export const submit = mutation({
  args: {
    clientStrokeId: v.string(),
    clientId: v.string(),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    brushType: v.optional(brushTypeValidator),
    color: v.string(),
    width: v.number(),
    opacity: v.optional(v.number()),
    points: v.array(pointValidator),
    clientTimestamp: v.number(),
  },
  returns: v.object({ sequence: v.number() }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    assertBoundedIdentifier(
      args.clientStrokeId,
      "clientStrokeId",
      MAX_CLIENT_STROKE_ID_LENGTH,
    );
    if (args.color.length > MAX_COLOR_LENGTH) {
      throw new Error(`color must not exceed ${MAX_COLOR_LENGTH} characters`);
    }
    if (!Number.isFinite(args.clientTimestamp)) {
      throw new Error("clientTimestamp must be a finite number");
    }
    // --- Abuse boundary: validate hard, reject on violation ---
    if (
      !Number.isFinite(args.width) ||
      args.width < MIN_BRUSH_WIDTH ||
      args.width > MAX_BRUSH_WIDTH
    ) {
      throw new Error(
        `width must be in [${MIN_BRUSH_WIDTH}, ${MAX_BRUSH_WIDTH}]`,
      );
    }
    if (
      args.points.length < MIN_POINTS_PER_STROKE ||
      args.points.length > MAX_POINTS_PER_STROKE
    ) {
      throw new Error(
        `points.length must be in [${MIN_POINTS_PER_STROKE}, ${MAX_POINTS_PER_STROKE}]`,
      );
    }
    for (const p of args.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new Error("point coordinates must be finite numbers");
      }
      if (p.x < 0 || p.x > WORLD_WIDTH || p.y < 0 || p.y > WORLD_HEIGHT) {
        throw new Error(
          `point coordinates must be within [0, ${WORLD_WIDTH}] x [0, ${WORLD_HEIGHT}]`,
        );
      }
    }
    if (!COLOR_PATTERN.test(args.color)) {
      throw new Error("color must be a hex or rgb()/rgba() string");
    }
    if (
      args.opacity !== undefined &&
      (!Number.isFinite(args.opacity) || args.opacity < MIN_OPACITY || args.opacity > MAX_OPACITY)
    ) {
      throw new Error(`opacity must be in [${MIN_OPACITY}, ${MAX_OPACITY}]`);
    }
    // mode is already constrained to "draw" | "erase" by the args validator.

    // --- Idempotency: retry-safe on clientStrokeId ---
    const existing = await ctx.db
      .query("strokes")
      .withIndex("by_clientStrokeId", (q) =>
        q.eq("clientStrokeId", args.clientStrokeId),
      )
      .unique();
    if (existing !== null) {
      return { sequence: existing.sequence };
    }

    await consumeRateLimit(
      ctx,
      `strokes:client:${args.clientId}`,
      STROKES_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(
      ctx,
      "strokes:global",
      STROKES_GLOBAL_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );

    // --- Sequencing: transactional read-increment-write on the singleton ---
    let metadata = await ctx.db.query("canvasMetadata").first();
    if (metadata === null) {
      const id = await ctx.db.insert("canvasMetadata", {
        currentSequence: 0,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
      });
      metadata = await ctx.db.get(id);
      if (metadata === null) throw new Error("failed to create canvasMetadata");
    }
    const nextSequence = metadata.currentSequence + 1;
    await ctx.db.patch(metadata._id, { currentSequence: nextSequence });

    await ctx.db.insert("strokes", {
      clientStrokeId: args.clientStrokeId,
      clientId: args.clientId,
      mode: args.mode,
      brushType: args.mode === "draw" ? (args.brushType ?? "brush") : undefined,
      color: args.color,
      width: args.width,
      opacity: args.opacity ?? 1,
      points: args.points,
      clientTimestamp: args.clientTimestamp,
      sequence: nextSequence,
      serverTimestamp: Date.now(),
    });

    return { sequence: nextSequence };
  },
});

export const listSince = query({
  args: {
    afterSequence: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(strokeReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(
      Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT),
      MAX_LIST_LIMIT,
    );
    const rows = await ctx.db
      .query("strokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", args.afterSequence))
      .order("asc")
      .take(limit);
    return rows;
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(strokeReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(
      Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT),
      MAX_LIST_LIMIT,
    );
    const rows = await ctx.db
      .query("strokes")
      .withIndex("by_sequence")
      .order("desc")
      .take(limit);
    return rows.reverse();
  },
});
