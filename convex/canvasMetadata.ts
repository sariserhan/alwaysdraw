import type { MutationCtx } from "./_generated/server";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";

/** Claims the next global stroke sequence number, transactional
 * read-increment-write on the canvasMetadata singleton. Shared by
 * strokes.submit (a new stroke) and admin's soft-deletes (a tombstone
 * patch) — both need a real, unique, monotonically-increasing sequence, so
 * clients' incremental sync (keyed off "sequence > afterSequence") picks
 * them up as a new event instead of silently missing them. Lives in its
 * own module, not strokes.ts or admin.ts, since both of those already
 * import from each other's sibling and a third import between them would
 * be circular. */
export async function claimNextSequence(ctx: MutationCtx): Promise<number> {
  let metadata = await ctx.db.query("canvasMetadata").first();
  if (metadata === null) {
    const id = await ctx.db.insert("canvasMetadata", {
      currentSequence: 0,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    });
    metadata = await ctx.db.get(id);
    if (metadata === null) throw new Error("failed to create canvasMetadata");
  }
  const next = metadata.currentSequence + 1;
  await ctx.db.patch(metadata._id, { currentSequence: next });
  return next;
}
