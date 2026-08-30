// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { BrushType } from "../lib/types";
import { BOARD_STROKES_GLOBAL_WINDOW } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseArgs = {
  clientStrokeId: "stroke-1",
  clientId: "anon-tester",
  mode: "draw" as const,
  brushType: "brush" as BrushType,
  color: "#e0432b",
  width: 8,
  opacity: 1,
  points: [{ x: 10, y: 10 }],
  clientTimestamp: 0,
};

describe("boardStrokes.submit", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("accepts a valid stroke and returns an increasing sequence", async () => {
    const first = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "a" });
    const second = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "b" });
    expect(second.sequence).toBeGreaterThan(first.sequence);
  });

  it("is idempotent on clientStrokeId", async () => {
    const first = await t.mutation(api.boardStrokes.submit, baseArgs);
    const second = await t.mutation(api.boardStrokes.submit, baseArgs);
    expect(second.sequence).toBe(first.sequence);
  });

  it("rejects a point outside the fixed board bounds", async () => {
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, points: [{ x: 99999, y: 10 }] }),
    ).rejects.toThrow(/board bounds|BOARD_WIDTH|within/i);
  });

  it("rejects an invalid color", async () => {
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, color: "not-a-color" }),
    ).rejects.toThrow(/color/);
  });

  it("rejects a username containing a blocked word", async () => {
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, username: "fuck" }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
  });

  it("rate limits excessive global submissions", async () => {
    // Driving this boundary with 2000 real submit() calls (one per unit of
    // BOARD_STROKES_GLOBAL_WINDOW) was flaky and slow: consumeRateLimit
    // (convex/abuse.ts) keys its window off real Date.now(), so 2000
    // unmocked sequential calls racing a 10s window could land in more than
    // one window, and even once that was fixed with frozen time, the sheer
    // number of real convex-test round trips risked exceeding vitest's
    // default 5s per-test timeout under load.
    //
    // Seed the rateLimits row directly at one-under-the-limit instead — this
    // exercises the exact same tryConsumeRateLimit read/compare code path
    // (convex/abuse.ts's `existing.count >= limit`) with 2 real mutations
    // instead of 2001, with no dependence on real or fake time at all.
    const key = "boardStrokes:global";
    await t.run(async (ctx: MutationCtx) => {
      await ctx.db.insert("rateLimits", {
        key,
        windowStartedAt: Date.now(),
        count: BOARD_STROKES_GLOBAL_WINDOW - 1,
      });
    });

    // One under the limit: succeeds, and pushes the bucket to the limit.
    await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "flood-last", clientId: "flooder-last" });

    // At the limit: rejected.
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "flood-over", clientId: "flooder-over" }),
    ).rejects.toThrow(/rate limit/i);
  });
});

describe("boardStrokes.listSince", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns only strokes after the given sequence, in ascending order", async () => {
    const a = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "a" });
    const b = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "b" });
    const rows = await t.query(api.boardStrokes.listSince, { afterSequence: a.sequence });
    expect(rows).toHaveLength(1);
    expect(rows[0].sequence).toBe(b.sequence);
  });
});
