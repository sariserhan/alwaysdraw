import { v } from "convex/values";
import { query } from "./_generated/server";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";

export const getMetadata = query({
  args: {},
  returns: v.object({
    currentSequence: v.number(),
    width: v.number(),
    height: v.number(),
  }),
  handler: async (ctx) => {
    const row = await ctx.db.query("canvasMetadata").first();
    if (row === null) {
      // Queries can't write; the singleton row is created lazily by strokes.submit.
      return { currentSequence: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    }
    return {
      currentSequence: row.currentSequence,
      width: row.width,
      height: row.height,
    };
  },
});
