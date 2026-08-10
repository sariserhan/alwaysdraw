import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { WORLD_WIDTH, WORLD_HEIGHT, MAX_CLIENT_ID_LENGTH } from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled } from "./abuse";

const bookmarkReturnFields = v.object({
  _id: v.id("bookmarks"),
  _creationTime: v.number(),
  title: v.string(),
  x: v.number(),
  y: v.number(),
  zoom: v.number(),
  clientId: v.string(),
  createdAt: v.number(),
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(bookmarkReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 30), 100);
    const rows = await ctx.db
      .query("bookmarks")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
    return rows;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    x: v.number(),
    y: v.number(),
    zoom: v.number(),
    clientId: v.string(),
  },
  returns: v.object({ id: v.id("bookmarks") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);

    const title = args.title.trim();
    if (!title || title.length > 50) {
      throw new Error("title must be between 1 and 50 characters");
    }

    if (!Number.isFinite(args.x) || args.x < 0 || args.x > WORLD_WIDTH) {
      throw new Error(`x must be within [0, ${WORLD_WIDTH}]`);
    }

    if (!Number.isFinite(args.y) || args.y < 0 || args.y > WORLD_HEIGHT) {
      throw new Error(`y must be within [0, ${WORLD_HEIGHT}]`);
    }

    if (!Number.isFinite(args.zoom) || args.zoom < 0.1 || args.zoom > 10) {
      throw new Error("zoom must be between 0.1 and 10");
    }

    const id = await ctx.db.insert("bookmarks", {
      title,
      x: Math.round(args.x),
      y: Math.round(args.y),
      zoom: Number(args.zoom.toFixed(2)),
      clientId: args.clientId,
      createdAt: Date.now(),
    });

    return { id };
  },
});
