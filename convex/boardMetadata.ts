import type { MutationCtx } from "./_generated/server";

/** Claims the next Board stroke sequence number — same
 * transactional read-increment-write pattern as canvasMetadata's version
 * for the main wall, on Board's own separate singleton row. Shared by
 * boardStrokes.submit (a new stroke) and boardAdmin's soft-deletes (a
 * tombstone patch) — both need a real, unique, monotonically-increasing
 * sequence so clients' incremental sync picks them up as a new event. */
export async function claimNextSequence(ctx: MutationCtx): Promise<number> {
  let metadata = await ctx.db.query("boardMetadata").first();
  if (metadata === null) {
    const id = await ctx.db.insert("boardMetadata", { currentSequence: 0 });
    metadata = await ctx.db.get(id);
    if (metadata === null) throw new Error("failed to create boardMetadata");
  }
  const next = metadata.currentSequence + 1;
  await ctx.db.patch(metadata._id, { currentSequence: next });
  return next;
}
