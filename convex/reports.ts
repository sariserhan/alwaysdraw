import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_CLIENT_ID_LENGTH,
  MAX_REPORT_REASON_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  REPORTS_PER_CLIENT_WINDOW,
  REPORTS_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { isPasscodeValid, verifyAdminPasscode } from "./admin";

const reportReturnFields = v.object({
  _id: v.id("contentReports"),
  _creationTime: v.number(),
  reporterId: v.string(),
  targetType: v.union(v.literal("area"), v.literal("comment")),
  x: v.optional(v.number()),
  y: v.optional(v.number()),
  zoom: v.optional(v.number()),
  minX: v.optional(v.number()),
  minY: v.optional(v.number()),
  maxX: v.optional(v.number()),
  maxY: v.optional(v.number()),
  commentId: v.optional(v.id("canvasComments")),
  reason: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed")),
  createdAt: v.number(),
  // Denormalized at read time for "comment" reports so the admin queue can
  // show what's actually being reported without a second round-trip —
  // absent if the comment was since deleted.
  commentText: v.optional(v.string()),
  commentAuthor: v.optional(v.string()),
});

function isFiniteWorldCoord(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= Math.max(WORLD_WIDTH, WORLD_HEIGHT);
}

export const create = mutation({
  args: {
    reporterId: v.string(),
    targetType: v.union(v.literal("area"), v.literal("comment")),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    zoom: v.optional(v.number()),
    // A drag-marked rectangle takes precedence over x/y/zoom when both are
    // present — see components/ReportButton.tsx.
    minX: v.optional(v.number()),
    minY: v.optional(v.number()),
    maxX: v.optional(v.number()),
    maxY: v.optional(v.number()),
    commentId: v.optional(v.id("canvasComments")),
    reason: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("contentReports") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.reporterId, "reporterId", MAX_CLIENT_ID_LENGTH);

    if (args.reason !== undefined && args.reason.length > MAX_REPORT_REASON_LENGTH) {
      throw new Error(`reason must not exceed ${MAX_REPORT_REASON_LENGTH} characters`);
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
          !isFiniteWorldCoord(args.minX) ||
          !isFiniteWorldCoord(args.minY) ||
          !isFiniteWorldCoord(args.maxX) ||
          !isFiniteWorldCoord(args.maxY) ||
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
        args.x > WORLD_WIDTH ||
        args.y < 0 ||
        args.y > WORLD_HEIGHT
      ) {
        throw new Error(`an "area" report needs x/y within [0, ${WORLD_WIDTH}]/[0, ${WORLD_HEIGHT}]`);
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
      `contentReports:client:${args.reporterId}`,
      REPORTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "contentReports:global", REPORTS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const id = await ctx.db.insert("contentReports", {
      reporterId: args.reporterId,
      targetType: args.targetType,
      x: args.x,
      y: args.y,
      zoom: args.zoom,
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

/** Admin queue: open reports, oldest first. Safe query — bad passcode just
 * returns an empty list rather than throwing, same convention as
 * getTelemetry. */
export const listOpen = query({
  args: { passcode: v.string() },
  returns: v.array(reportReturnFields),
  handler: async (ctx, args) => {
    if (!isPasscodeValid(args.passcode)) {
      return [];
    }
    const reports = await ctx.db
      .query("contentReports")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "open"))
      .order("asc")
      .take(100);

    return await Promise.all(
      reports.map(async (r) => {
        const comment =
          r.targetType === "comment" && r.commentId !== undefined
            ? await ctx.db.get(r.commentId)
            : null;
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
    reportId: v.id("contentReports"),
    status: v.union(v.literal("reviewed"), v.literal("dismissed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await verifyAdminPasscode(ctx, args.passcode);
    await ctx.db.patch(args.reportId, { status: args.status });
    return null;
  },
});
