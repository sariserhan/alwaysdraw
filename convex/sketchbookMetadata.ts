import type { MutationCtx } from "./_generated/server";

/** Claims the next sketchbook stroke sequence number — transactional
 * read-increment-write on the sketchbookMetadata singleton. Mirrors
 * convex/canvasMetadata.ts's claimNextSequence exactly, against its own
 * table, so the sketchbook's incremental sync never shares a sequence
 * space with the main canvas. */
export async function claimNextSequence(ctx: MutationCtx): Promise<number> {
  let metadata = await ctx.db.query("sketchbookMetadata").first();
  if (metadata === null) {
    const id = await ctx.db.insert("sketchbookMetadata", { currentSequence: 0 });
    metadata = await ctx.db.get(id);
    if (metadata === null) throw new Error("failed to create sketchbookMetadata");
  }
  const next = metadata.currentSequence + 1;
  await ctx.db.patch(metadata._id, { currentSequence: next });
  return next;
}
