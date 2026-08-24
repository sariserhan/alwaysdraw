import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  MIN_BRUSH_WIDTH,
  MAX_BRUSH_WIDTH,
  MIN_OPACITY,
  MAX_OPACITY,
  MIN_POINTS_PER_STROKE,
  MAX_POINTS_PER_STROKE,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  COLOR_PATTERN,
  MAX_CLIENT_ID_LENGTH,
  MAX_CLIENT_STROKE_ID_LENGTH,
  MAX_COLOR_LENGTH,
  MAX_USERNAME_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
  SKETCHBOOK_STROKES_PER_CLIENT_WINDOW,
  SKETCHBOOK_STROKES_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { containsProfanity } from "./profanity";
import { claimNextSequence } from "./sketchbookMetadata";
import { SKETCHBOOK_PAGE_WIDTH, SKETCHBOOK_PAGE_HEIGHT, SKETCHBOOK_REGIONS } from "../lib/sketchbookOutline";

const pointValidator = v.object({ x: v.number(), y: v.number() });
const SKETCHBOOK_REGION_IDS = new Set(SKETCHBOOK_REGIONS.map((r) => r.id));

const sketchbookStrokeReturnFields = v.object({
  _id: v.id("sketchbookStrokes"),
  _creationTime: v.number(),
  clientStrokeId: v.string(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  mode: v.union(v.literal("draw"), v.literal("erase")),
  regionId: v.string(),
  color: v.string(),
  width: v.number(),
  opacity: v.optional(v.number()),
  points: v.array(pointValidator),
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
    regionId: v.string(),
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
    assertBoundedIdentifier(args.clientStrokeId, "clientStrokeId", MAX_CLIENT_STROKE_ID_LENGTH);
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
    if (!SKETCHBOOK_REGION_IDS.has(args.regionId)) {
      throw new Error(`unknown regionId: ${args.regionId}`);
    }
    if (!Number.isFinite(args.width) || args.width < MIN_BRUSH_WIDTH || args.width > MAX_BRUSH_WIDTH) {
      throw new Error(`width must be in [${MIN_BRUSH_WIDTH}, ${MAX_BRUSH_WIDTH}]`);
    }
    if (args.points.length < MIN_POINTS_PER_STROKE || args.points.length > MAX_POINTS_PER_STROKE) {
      throw new Error(`points.length must be in [${MIN_POINTS_PER_STROKE}, ${MAX_POINTS_PER_STROKE}]`);
    }
    for (const p of args.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new Error("point coordinates must be finite numbers");
      }
      if (p.x < 0 || p.x > SKETCHBOOK_PAGE_WIDTH || p.y < 0 || p.y > SKETCHBOOK_PAGE_HEIGHT) {
        throw new Error(
          `point coordinates must be within [0, ${SKETCHBOOK_PAGE_WIDTH}] x [0, ${SKETCHBOOK_PAGE_HEIGHT}]`,
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

    const existing = await ctx.db
      .query("sketchbookStrokes")
      .withIndex("by_clientStrokeId", (q) => q.eq("clientStrokeId", args.clientStrokeId))
      .unique();
    if (existing !== null) {
      return { sequence: existing.sequence };
    }

    await consumeRateLimit(
      ctx,
      `sketchbookStrokes:client:${args.clientId}`,
      SKETCHBOOK_STROKES_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "sketchbookStrokes:global", SKETCHBOOK_STROKES_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const nextSequence = await claimNextSequence(ctx);

    await ctx.db.insert("sketchbookStrokes", {
      clientStrokeId: args.clientStrokeId,
      clientId: args.clientId,
      username: args.username,
      countryCode: args.countryCode,
      mode: args.mode,
      regionId: args.regionId,
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
  returns: v.array(sketchbookStrokeReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT);
    const rows = await ctx.db
      .query("sketchbookStrokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", args.afterSequence))
      .order("asc")
      .take(limit);
    return rows;
  },
});
