import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  MAX_CLIENT_ID_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_COMMENT_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
  BOARD_COMMENTS_PER_CLIENT_WINDOW,
  BOARD_COMMENTS_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { verifyAdminPasscode } from "./admin";
import { containsProfanity } from "./profanity";

const boardCommentReturnFields = v.object({
  _id: v.id("boardComments"),
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
  args: { limit: v.optional(v.number()) },
  returns: v.array(boardCommentReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 200), 500);
    return await ctx.db.query("boardComments").withIndex("by_createdAt").order("desc").take(limit);
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
  returns: v.object({ id: v.id("boardComments") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
      if (containsProfanity(args.username)) {
        throw new ConvexError("PROFANITY_BLOCKED: username contains a blocked word — please choose another");
      }
    }
    if (args.countryCode !== undefined && !COUNTRY_CODE_PATTERN.test(args.countryCode)) {
      throw new Error("countryCode must be a 2-letter ISO 3166-1 alpha-2 code");
    }
    const text = args.text.trim();
    if (!text || text.length > MAX_COMMENT_LENGTH) {
      throw new Error(`comment must be between 1 and ${MAX_COMMENT_LENGTH} characters`);
    }
    if (containsProfanity(text)) {
      throw new ConvexError("PROFANITY_BLOCKED: comment contains a blocked word");
    }
    if (!Number.isFinite(args.x) || args.x < 0 || args.x > BOARD_WIDTH) {
      throw new Error(`x must be within [0, ${BOARD_WIDTH}]`);
    }
    if (!Number.isFinite(args.y) || args.y < 0 || args.y > BOARD_HEIGHT) {
      throw new Error(`y must be within [0, ${BOARD_HEIGHT}]`);
    }
    await consumeRateLimit(
      ctx,
      `boardComments:client:${args.clientId}`,
      BOARD_COMMENTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "boardComments:global", BOARD_COMMENTS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const id = await ctx.db.insert("boardComments", {
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
  args: { commentId: v.id("boardComments"), clientId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (comment === null) return null;
    if (comment.clientId !== args.clientId) {
      throw new Error("can only delete your own comment");
    }
    await consumeRateLimit(
      ctx,
      `boardComments:remove:client:${args.clientId}`,
      BOARD_COMMENTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await ctx.db.delete(args.commentId);
    return null;
  },
});

export const adminRemove = mutation({
  args: { passcode: v.string(), commentId: v.id("boardComments") },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false, error: verified.error };
    }
    await ctx.db.delete(args.commentId);
    return { success: true as const };
  },
});
