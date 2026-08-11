// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { StrokeMode, BrushType, Point } from "../lib/types";

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
