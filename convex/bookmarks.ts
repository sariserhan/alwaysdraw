import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MAX_CLIENT_ID_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_COMMENT_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  BOOKMARKS_PER_CLIENT_WINDOW,
  BOOKMARKS_GLOBAL_WINDOW,
  COMMENTS_PER_CLIENT_WINDOW,
  COMMENTS_GLOBAL_WINDOW,
  VOTES_PER_CLIENT_WINDOW,
} from "./constants";
import {
  assertBoundedIdentifier,
  assertWritesEnabled,
  consumeRateLimit,
} from "./abuse";

const bookmarkReturnFields = v.object({
  _id: v.id("bookmarks"),
  _creationTime: v.number(),
  title: v.string(),
  x: v.number(),
  y: v.number(),
  zoom: v.number(),
  clientId: v.string(),
  createdAt: v.number(),
  voteCount: v.optional(v.number()),
  commentCount: v.optional(v.number()),
});

const galleryEntryFields = v.object({
  _id: v.id("bookmarks"),
  _creationTime: v.number(),
  title: v.string(),
  x: v.number(),
  y: v.number(),
  zoom: v.number(),
  clientId: v.string(),
  createdAt: v.number(),
  voteCount: v.number(),
  commentCount: v.number(),
  hasVoted: v.boolean(),
});

const commentReturnFields = v.object({
  _id: v.id("bookmarkComments"),
  _creationTime: v.number(),
  bookmarkId: v.id("bookmarks"),
  clientId: v.string(),
  username: v.optional(v.string()),
  text: v.string(),
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
    await consumeRateLimit(
      ctx,
      `bookmarks:client:${args.clientId}`,
      BOOKMARKS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(
      ctx,
      "bookmarks:global",
      BOOKMARKS_GLOBAL_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );

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
      voteCount: 0,
      commentCount: 0,
    });

    return { id };
  },
});

/** Ranked by votes for the community gallery — highest-voted first. */
export const listGallery = query({
  args: {
    clientId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(galleryEntryFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 30), 100);
    const rows = await ctx.db
      .query("bookmarks")
      .withIndex("by_voteCount")
      .order("desc")
      .take(limit);

    return await Promise.all(
      rows.map(async (row) => {
        const myVote = await ctx.db
          .query("bookmarkVotes")
          .withIndex("by_bookmark_and_client", (q) =>
            q.eq("bookmarkId", row._id).eq("clientId", args.clientId),
          )
          .unique();
        return {
          _id: row._id,
          _creationTime: row._creationTime,
          title: row.title,
          x: row.x,
          y: row.y,
          zoom: row.zoom,
          clientId: row.clientId,
          createdAt: row.createdAt,
          voteCount: row.voteCount ?? 0,
          commentCount: row.commentCount ?? 0,
          hasVoted: myVote !== null,
        };
      }),
    );
  },
});

/** Toggles the requesting client's vote on a bookmark — one vote per
 * (bookmark, client), clicking again removes it. */
export const toggleVote = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    clientId: v.string(),
  },
  returns: v.object({ voted: v.boolean(), voteCount: v.number() }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    await consumeRateLimit(
      ctx,
      `bookmarkVotes:client:${args.clientId}`,
      VOTES_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );

    const bookmark = await ctx.db.get(args.bookmarkId);
    if (bookmark === null) throw new Error("bookmark not found");

    const existing = await ctx.db
      .query("bookmarkVotes")
      .withIndex("by_bookmark_and_client", (q) =>
        q.eq("bookmarkId", args.bookmarkId).eq("clientId", args.clientId),
      )
      .unique();

    const nextCount = (bookmark.voteCount ?? 0) + (existing ? -1 : 1);
    await ctx.db.patch(args.bookmarkId, { voteCount: Math.max(0, nextCount) });

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("bookmarkVotes", {
        bookmarkId: args.bookmarkId,
        clientId: args.clientId,
        createdAt: Date.now(),
      });
    }

    return { voted: !existing, voteCount: Math.max(0, nextCount) };
  },
});

export const listComments = query({
  args: {
    bookmarkId: v.id("bookmarks"),
    limit: v.optional(v.number()),
  },
  returns: v.array(commentReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 50), 100);
    return await ctx.db
      .query("bookmarkComments")
      .withIndex("by_bookmark", (q) => q.eq("bookmarkId", args.bookmarkId))
      .order("desc")
      .take(limit);
  },
});

export const addComment = mutation({
  args: {
    bookmarkId: v.id("bookmarks"),
    clientId: v.string(),
    username: v.optional(v.string()),
    text: v.string(),
  },
  returns: v.object({ id: v.id("bookmarkComments") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
    }
    const text = args.text.trim();
    if (!text || text.length > MAX_COMMENT_LENGTH) {
      throw new Error(`comment must be between 1 and ${MAX_COMMENT_LENGTH} characters`);
    }

    const bookmark = await ctx.db.get(args.bookmarkId);
    if (bookmark === null) throw new Error("bookmark not found");

    await consumeRateLimit(
      ctx,
      `bookmarkComments:client:${args.clientId}`,
      COMMENTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(
      ctx,
      "bookmarkComments:global",
      COMMENTS_GLOBAL_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );

    const id = await ctx.db.insert("bookmarkComments", {
      bookmarkId: args.bookmarkId,
      clientId: args.clientId,
      username: args.username,
      text,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.bookmarkId, { commentCount: (bookmark.commentCount ?? 0) + 1 });

    return { id };
  },
});
