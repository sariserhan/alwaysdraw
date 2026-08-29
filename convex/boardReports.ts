import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  MAX_CLIENT_ID_LENGTH,
  MAX_REPORT_REASON_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  BOARD_REPORTS_PER_CLIENT_WINDOW,
  BOARD_REPORTS_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { isPasscodeValid, verifyAdminPasscode } from "./admin";
import { containsProfanity } from "./profanity";

const boardReportReturnFields = v.object({
  _id: v.id("boardReports"),
  _creationTime: v.number(),
  reporterId: v.string(),
  targetType: v.union(v.literal("area"), v.literal("comment")),
  x: v.optional(v.number()),
  y: v.optional(v.number()),
  minX: v.optional(v.number()),
  minY: v.optional(v.number()),
  maxX: v.optional(v.number()),
  maxY: v.optional(v.number()),
  commentId: v.optional(v.id("boardComments")),
  reason: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed")),
  createdAt: v.number(),
  commentText: v.optional(v.string()),
  commentAuthor: v.optional(v.string()),
});

function isFiniteBoardCoord(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= Math.max(BOARD_WIDTH, BOARD_HEIGHT);
}

export const create = mutation({
  args: {
    reporterId: v.string(),
    targetType: v.union(v.literal("area"), v.literal("comment")),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    minX: v.optional(v.number()),
    minY: v.optional(v.number()),
    maxX: v.optional(v.number()),
    maxY: v.optional(v.number()),
    commentId: v.optional(v.id("boardComments")),
    reason: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("boardReports") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.reporterId, "reporterId", MAX_CLIENT_ID_LENGTH);

    if (args.reason !== undefined) {
      if (args.reason.length > MAX_REPORT_REASON_LENGTH) {
        throw new Error(`reason must not exceed ${MAX_REPORT_REASON_LENGTH} characters`);
      }
      if (containsProfanity(args.reason)) {
        throw new ConvexError("PROFANITY_BLOCKED: reason contains a blocked word — please rephrase");
      }
    }

    const hasRect =
      args.minX !== undefined || args.minY !== undefined || args.maxX !== undefined || args.maxY !== undefined;

    if (args.targetType === "area") {
      if (hasRect) {
        if (
          args.minX === undefined ||
          args.minY === undefined ||
          args.maxX === undefined ||
          args.maxY === undefined ||
          !isFiniteBoardCoord(args.minX) ||
          !isFiniteBoardCoord(args.minY) ||
          !isFiniteBoardCoord(args.maxX) ||
          !isFiniteBoardCoord(args.maxY) ||
          args.minX >= args.maxX ||
          args.minY >= args.maxY
        ) {
          throw new Error("a marked-area report needs a valid minX/minY/maxX/maxY rectangle");
        }
      } else if (
        args.x === undefined ||
        args.y === undefined ||
        !Number.isFinite(args.x) ||
        !Number.isFinite(args.y) ||
        args.x < 0 ||
        args.x > BOARD_WIDTH ||
        args.y < 0 ||
        args.y > BOARD_HEIGHT
      ) {
        throw new Error(`an "area" report needs x/y within [0, ${BOARD_WIDTH}]/[0, ${BOARD_HEIGHT}]`);
      }
    } else {
      if (args.commentId === undefined) {
        throw new Error('a "comment" report needs commentId');
      }
      const comment = await ctx.db.get(args.commentId);
      if (comment === null) {
        throw new Error("that comment no longer exists");
      }
    }

    await consumeRateLimit(
      ctx,
      `boardReports:client:${args.reporterId}`,
      BOARD_REPORTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "boardReports:global", BOARD_REPORTS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const id = await ctx.db.insert("boardReports", {
      reporterId: args.reporterId,
      targetType: args.targetType,
      x: args.x,
      y: args.y,
      minX: args.minX,
      minY: args.minY,
      maxX: args.maxX,
      maxY: args.maxY,
      commentId: args.commentId,
      reason: args.reason?.trim() || undefined,
      status: "open",
      createdAt: Date.now(),
    });

    return { id };
  },
});

export const listOpen = query({
  args: { passcode: v.string() },
  returns: v.array(boardReportReturnFields),
  handler: async (ctx, args) => {
    if (!isPasscodeValid(args.passcode)) {
      return [];
    }
    const reports = await ctx.db
      .query("boardReports")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "open"))
      .order("asc")
      .take(100);

    return await Promise.all(
      reports.map(async (r) => {
        const comment =
          r.targetType === "comment" && r.commentId !== undefined ? await ctx.db.get(r.commentId) : null;
        return {
          ...r,
          commentText: comment?.text,
          commentAuthor: comment?.username,
        };
      }),
    );
  },
});

export const updateStatus = mutation({
  args: {
    passcode: v.string(),
    reportId: v.id("boardReports"),
    status: v.union(v.literal("reviewed"), v.literal("dismissed")),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false, error: verified.error };
    }
    await ctx.db.patch(args.reportId, { status: args.status });
    return { success: true as const };
  },
});
