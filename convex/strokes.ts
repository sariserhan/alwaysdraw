import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getTileKeysForStroke } from "../lib/tiling";
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
  MAX_USERNAME_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
  STROKES_PER_CLIENT_WINDOW,
  STROKES_GLOBAL_WINDOW,
  MAX_PROTECTED_ZONES,
} from "./constants";
import {
  assertBoundedIdentifier,
  assertWritesEnabled,
  consumeRateLimit,
} from "./abuse";
import { isPasscodeValid } from "./admin";
import { containsProfanity } from "./profanity";
import { claimNextSequence } from "./canvasMetadata";

const pointValidator = v.object({ x: v.number(), y: v.number() });
const brushTypeValidator = v.union(...BRUSH_TYPES.map((t) => v.literal(t)));

const strokeReturnFields = v.object({
  _id: v.id("strokes"),
  _creationTime: v.number(),
  clientStrokeId: v.string(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  mode: v.union(v.literal("draw"), v.literal("erase")),
  brushType: v.optional(brushTypeValidator),
  color: v.string(),
  width: v.number(),
  opacity: v.optional(v.number()),
  points: v.array(pointValidator),
  tiles: v.optional(v.array(v.string())),
  clientTimestamp: v.number(),
  sequence: v.number(),
  serverTimestamp: v.number(),
  deleted: v.optional(v.boolean()),
});

export const submit = mutation({
  args: {
    clientStrokeId: v.string(),
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    brushType: v.optional(brushTypeValidator),
    color: v.string(),
    width: v.number(),
    opacity: v.optional(v.number()),
    points: v.array(pointValidator),
    clientTimestamp: v.number(),
    // Only set by the admin image-stamping path — a real, server-verified
    // credential, not the clientId string (which is client-supplied and
    // unauthenticated, so it must never be trusted to grant a bypass).
    adminPasscode: v.optional(v.string()),
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
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
      if (containsProfanity(args.username)) {
        throw new ConvexError("PROFANITY_BLOCKED: username contains a blocked word — please choose another");
      }
    }
    if (args.countryCode !== undefined && !COUNTRY_CODE_PATTERN.test(args.countryCode)) {
      throw new Error("countryCode must be a 2-letter ISO 3166-1 alpha-2 code");
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

    // --- Protected Canvas Zones Validation ---
    const isVerifiedAdmin = args.adminPasscode !== undefined && isPasscodeValid(args.adminPasscode);
    if (!isVerifiedAdmin) {
      const protectedZones = await ctx.db.query("protectedZones").take(MAX_PROTECTED_ZONES);
      if (protectedZones.length > 0) {
        for (const zone of protectedZones) {
          if (zone.ownerClientId && zone.ownerClientId === args.clientId) continue;
          const hitsZone = args.points.some(
            (p) => p.x >= zone.minX && p.x <= zone.maxX && p.y >= zone.minY && p.y <= zone.maxY,
          );
          if (hitsZone) {
            throw new ConvexError(
              `PROTECTED_ZONE: Canvas area "${zone.name}" is protected by Admin to preserve community artwork.`,
            );
          }
        }
      }
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
    const nextSequence = await claimNextSequence(ctx);

    // Compute spatial tiles spanned by this stroke
    const tileKeys = getTileKeysForStroke(args.points, args.width, WORLD_WIDTH, WORLD_HEIGHT);

    await ctx.db.insert("strokes", {
      clientStrokeId: args.clientStrokeId,
      clientId: args.clientId,
      username: args.username,
      countryCode: args.countryCode,
      mode: args.mode,
      brushType: args.mode === "draw" ? (args.brushType ?? "brush") : undefined,
      color: args.color,
      width: args.width,
      opacity: args.opacity ?? 1,
      points: args.points,
      tiles: tileKeys,
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

export const listByTiles = query({
  args: {
    tileKeys: v.array(v.string()),
    afterSequence: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.array(strokeReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(
      Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT),
      MAX_LIST_LIMIT,
    );
    const afterSeq = args.afterSequence ?? 0;
    const tileSet = new Set(args.tileKeys);

    if (tileSet.size === 0) return [];

    const rows = await ctx.db
      .query("strokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", afterSeq))
      .order("asc")
      .take(limit);

    return rows.filter((row) => {
      if (!row.tiles || row.tiles.length === 0) return true;
      return row.tiles.some((t) => tileSet.has(t));
    });
  },
});
