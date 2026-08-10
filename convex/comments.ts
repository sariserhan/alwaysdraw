import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_CLIENT_ID_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_COMMENT_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
  COMMENTS_PER_CLIENT_WINDOW,
  COMMENTS_GLOBAL_WINDOW,
} from "./constants";
import {
  assertBoundedIdentifier,
  assertWritesEnabled,
  consumeRateLimit,
} from "./abuse";

const commentReturnFields = v.object({
  _id: v.id("canvasComments"),
  _creationTime: v.number(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  text: v.string(),
  x: v.number(),
  y: v.number(),
  createdAt: v.number(),
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(commentReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 200), 500);
    return await ctx.db
      .query("canvasComments")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

export const create = mutation({
  args: {
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    text: v.string(),
    x: v.number(),
    y: v.number(),
  },
  returns: v.object({ id: v.id("canvasComments") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
    }
    if (args.countryCode !== undefined && !COUNTRY_CODE_PATTERN.test(args.countryCode)) {
      throw new Error("countryCode must be a 2-letter ISO 3166-1 alpha-2 code");
    }
    const text = args.text.trim();
    if (!text || text.length > MAX_COMMENT_LENGTH) {
      throw new Error(`comment must be between 1 and ${MAX_COMMENT_LENGTH} characters`);
    }
    if (!Number.isFinite(args.x) || args.x < 0 || args.x > WORLD_WIDTH) {
      throw new Error(`x must be within [0, ${WORLD_WIDTH}]`);
    }
    if (!Number.isFinite(args.y) || args.y < 0 || args.y > WORLD_HEIGHT) {
      throw new Error(`y must be within [0, ${WORLD_HEIGHT}]`);
    }

    await consumeRateLimit(
      ctx,
      `canvasComments:client:${args.clientId}`,
      COMMENTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(
      ctx,
      "canvasComments:global",
      COMMENTS_GLOBAL_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );

    const id = await ctx.db.insert("canvasComments", {
      clientId: args.clientId,
      username: args.username,
      countryCode: args.countryCode,
      text,
      x: Math.round(args.x),
      y: Math.round(args.y),
      createdAt: Date.now(),
    });

    return { id };
  },
});

export const remove = mutation({
  args: {
    commentId: v.id("canvasComments"),
    clientId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (comment === null) return null;
    // Anonymous, self-reported identity — same trust boundary as the rest of
    // this app (e.g. rollbackClient's targetClientId), not real auth. Still
    // worth enforcing: it stops a stray click from deleting someone else's
    // note even though a determined spoofer could bypass it.
    if (comment.clientId !== args.clientId) {
      throw new Error("can only delete your own comment");
    }
    await ctx.db.delete(args.commentId);
    return null;
  },
});
