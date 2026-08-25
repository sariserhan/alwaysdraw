// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { StrokeMode, BrushType, Point } from "../lib/types";
import { SNAPSHOTS_TO_KEEP, SNAPSHOTS_PRUNE_BATCH_SIZE, RATE_LIMIT_WINDOW_MS } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseStrokeArgs = {
  clientId: "anon-tester",
  mode: "draw" as StrokeMode,
  brushType: "brush" as BrushType | undefined,
  color: "#e0432b",
  width: 8,
  opacity: 1,
  points: [{ x: 10, y: 10 }] as Point[],
  clientTimestamp: 0,
};

/** Advances the real sequence counter by submitting `count` strokes, same
 * as a snapshot's `sequence` must never exceed in production — snapshot
 * tests need a real reachable sequence, not an arbitrary number. Kept well
 * under STROKES_PER_CLIENT_WINDOW so this doesn't trip the rate limiter. */
async function advanceSequence(t: ReturnType<typeof convexTest>, count: number): Promise<number> {
  let sequence = 0;
  for (let i = 0; i < count; i++) {
    const result = await t.mutation(api.strokes.submit, {
      ...baseStrokeArgs,
      clientStrokeId: `seq-advance-${crypto.randomUUID()}`,
    });
    sequence = result.sequence;
  }
  return sequence;
}

describe("snapshots query and mutation", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns null when no snapshots exist", async () => {
    const latest = await t.query(api.snapshots.getLatest, {});
    expect(latest).toBeNull();
  });

  it("submits and retrieves the latest snapshot sorted by sequence", async () => {
    const seqA = await advanceSequence(t, 5);
    const seqB = await advanceSequence(t, 5);
    const seqC = await advanceSequence(t, 5);

    await t.mutation(api.snapshots.submit, {
      sequence: seqA,
      imageData: "data:image/webp;base64,sampleA",
      strokeCount: 50,
    });
    await t.mutation(api.snapshots.submit, {
      sequence: seqC,
      imageData: "data:image/webp;base64,sampleC",
      strokeCount: 250,
    });
    await t.mutation(api.snapshots.submit, {
      sequence: seqB,
      imageData: "data:image/webp;base64,sampleB",
      strokeCount: 150,
    });

    const latest = await t.query(api.snapshots.getLatest, {});
    expect(latest).not.toBeNull();
    expect(latest?.sequence).toBe(seqC);
    expect(latest?.strokeCount).toBe(250);
    expect(latest?.imageData).toBe("data:image/webp;base64,sampleC");
  });

  it("prevents duplicate snapshots for the exact same sequence", async () => {
    const sequence = await advanceSequence(t, 5);

    const id1 = await t.mutation(api.snapshots.submit, {
      sequence,
      imageData: "data:image/webp;base64,sampleDupA",
      strokeCount: 5,
    });
    const id2 = await t.mutation(api.snapshots.submit, {
      sequence,
      imageData: "data:image/webp;base64,sampleDupB",
      strokeCount: 5,
    });

    expect(id1).toBe(id2);
  });

  it("rejects malformed imageData that isn't a base64 image data URL", async () => {
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 0,
        imageData: "not-a-data-url",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/imageData/);
  });

  it("rejects an oversized imageData payload", async () => {
    const huge = "data:image/webp;base64," + "A".repeat(6 * 1024 * 1024);
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 0,
        imageData: huge,
        strokeCount: 1,
      }),
    ).rejects.toThrow(/size limit/);
  });

  it("rejects a negative sequence or strokeCount", async () => {
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: -1,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/sequence/);
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 0,
        imageData: "data:image/webp;base64,sample",
        strokeCount: -1,
      }),
    ).rejects.toThrow(/strokeCount/);
  });

  it("rejects a sequence beyond the wall's real current sequence", async () => {
    // No strokes ever submitted — currentSequence is 0, so any positive
    // sequence is a lie about how far the wall has actually progressed.
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 1,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/current sequence/);

    const realSequence = await advanceSequence(t, 5);
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: realSequence + 1000,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/current sequence/);

    // The real, reachable sequence is still accepted.
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: realSequence,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 5,
      }),
    ).resolves.toBeDefined();
  });

  it("prunes to SNAPSHOTS_TO_KEEP, deleting the oldest rows first", async () => {
    // More submissions than SNAPSHOTS_GLOBAL_WINDOW allows in one window —
    // advance fake time between each so this exercises pruning, not the
    // rate limiter (already covered separately below).
    vi.useFakeTimers();
    const submittedCount = SNAPSHOTS_TO_KEEP + 3;
    try {
      for (let i = 0; i < submittedCount; i++) {
        const sequence = await advanceSequence(t, 1);
        await t.mutation(api.snapshots.submit, {
          sequence,
          imageData: `data:image/webp;base64,sample${i}`,
          strokeCount: i,
        });
        vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);
      }
    } finally {
      vi.useRealTimers();
    }

    const remaining = await t.run(async (ctx) => ctx.db.query("snapshots").collect());
    expect(remaining).toHaveLength(SNAPSHOTS_TO_KEEP);
    // The kept rows are the newest ones — every strokeCount below
    // (submittedCount - SNAPSHOTS_TO_KEEP) was pruned away.
    const keptStrokeCounts = remaining.map((r) => r.strokeCount).sort((a, b) => a - b);
    expect(keptStrokeCounts).toEqual(
      Array.from({ length: SNAPSHOTS_TO_KEEP }, (_, i) => submittedCount - SNAPSHOTS_TO_KEEP + i),
    );

    // getLatest still returns the actual latest, unaffected by pruning.
    const latest = await t.query(api.snapshots.getLatest, {});
    expect(latest?.strokeCount).toBe(submittedCount - 1);
  });

  it("prunes a large pre-existing backlog in bounded batches, never in one shot", async () => {
    // Regression test for a real production incident: pruning used to
    // .collect() the WHOLE table to find overflow. A 48-row backlog
    // accumulated before pruning ever existed read 17MB in one call,
    // exceeded Convex's per-transaction read cap, and failed the entire
    // submit mutation (including its own insert, since Convex mutations
    // are all-or-nothing) — repeatedly, since a failed prune never shrinks
    // the table for the next attempt either. Seed a backlog directly
    // (bypassing submit, simulating rows from before pruning existed) well
    // past what one bounded batch can clear, and confirm submit still
    // succeeds and only prunes a bounded batch per call.
    const backlogSize = SNAPSHOTS_TO_KEEP + SNAPSHOTS_PRUNE_BATCH_SIZE * 2 + 4;
    await t.run(async (ctx) => {
      for (let i = 0; i < backlogSize; i++) {
        await ctx.db.insert("snapshots", {
          sequence: i,
          imageData: `data:image/webp;base64,backlog${i}`,
          strokeCount: i,
          createdAt: Date.now(),
        });
      }
    });

    const sequence = await advanceSequence(t, backlogSize + 1);
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence,
        imageData: "data:image/webp;base64,newest",
        strokeCount: 999,
      }),
    ).resolves.toBeDefined();

    const afterOneSubmit = await t.run(async (ctx) => ctx.db.query("snapshots").collect());
    // Backlog (48) + this submit's own insert (1), minus one bounded batch
    // of deletions — nowhere near fully pruned yet, proving this call
    // didn't try to clear everything at once.
    expect(afterOneSubmit).toHaveLength(backlogSize + 1 - SNAPSHOTS_PRUNE_BATCH_SIZE);

    // Draining the rest takes several more submits, each still bounded —
    // eventually converges to SNAPSHOTS_TO_KEEP.
    vi.useFakeTimers();
    let remainingCount = afterOneSubmit.length;
    try {
      while (remainingCount > SNAPSHOTS_TO_KEEP) {
        const nextSequence = await advanceSequence(t, 1);
        await t.mutation(api.snapshots.submit, {
          sequence: nextSequence,
          imageData: `data:image/webp;base64,drain${remainingCount}`,
          strokeCount: remainingCount,
        });
        vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);
        remainingCount = (await t.run(async (ctx) => ctx.db.query("snapshots").collect())).length;
      }
    } finally {
      vi.useRealTimers();
    }
    expect(remainingCount).toBe(SNAPSHOTS_TO_KEEP);
  });

  it("rate limits excessive global submissions", async () => {
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.snapshots.submit, {
        sequence: 0,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      });
    }
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 0,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/rate limit/);
  });
});
