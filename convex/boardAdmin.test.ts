// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { MutationCtx } from "./_generated/server";
import { BOARD_WIPE_BATCH_SIZE, BOARD_PRUNE_BATCH_SIZE, RATE_LIMIT_WINDOW_MS } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const PASSCODE = "test-admin-passcode";

async function submitBoardStroke(t: ReturnType<typeof convexTest>, clientStrokeId: string) {
  return t.mutation(api.boardStrokes.submit, {
    clientStrokeId,
    clientId: "anon-tester",
    mode: "draw",
    color: "#000000",
    width: 4,
    points: [{ x: 10, y: 10 }],
    clientTimestamp: 0,
  });
}

describe("boardAdmin.wipeAll", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a wrong passcode without wiping anything", async () => {
    await submitBoardStroke(t, "a");
    const result = await t.mutation(api.boardAdmin.wipeAll, { passcode: "wrong" });
    expect(result.success).toBe(false);
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows.every((r) => !r.deleted)).toBe(true);
  });

  it("soft-deletes every stroke, never a real row delete", async () => {
    await submitBoardStroke(t, "a");
    await submitBoardStroke(t, "b");
    const result = await t.mutation(api.boardAdmin.wipeAll, { passcode: PASSCODE });
    expect(result.success).toBe(true);
    if (result.success) expect(result.deletedCount).toBe(2);
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.deleted)).toBe(true);
    // deletedAt (not serverTimestamp) is what pruneDeletedStrokes (Task 7)
    // keys off — must be set at deletion time, every time.
    expect(rows.every((r) => typeof r.deletedAt === "number")).toBe(true);
  });

  it("converges a backlog larger than BOARD_WIPE_BATCH_SIZE over multiple bounded calls", async () => {
    const backlogSize = BOARD_WIPE_BATCH_SIZE + 10;
    vi.useFakeTimers();
    try {
      for (let i = 0; i < backlogSize; i++) {
        await submitBoardStroke(t, `s-${i}`);
        vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);
      }
    } finally {
      vi.useRealTimers();
    }
    let done = false;
    let afterSequence: number | undefined;
    let calls = 0;
    while (!done) {
      const result = await t.mutation(api.boardAdmin.wipeAll, { passcode: PASSCODE, afterSequence });
      if (!result.success) throw new Error(result.error);
      done = result.done;
      afterSequence = result.nextAfterSequence;
      calls++;
      if (calls > 10) throw new Error("did not converge");
    }
    expect(calls).toBeGreaterThan(1);
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows.every((r) => r.deleted)).toBe(true);
  });
});

describe("boardAdmin auto-prune", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // `id` must be unique per call (it's used as both clientStrokeId and
  // clientId via submitBoardStroke) — submit() is idempotent on
  // clientStrokeId, so a repeated id would silently return the
  // already-existing row instead of inserting a new one, breaking any
  // loop that seeds more than one row.
  async function seedOldDeletedStroke(t: ReturnType<typeof convexTest>, id: string, ageMs: number) {
    const { sequence } = await submitBoardStroke(t, id);
    await t.run(async (ctx: MutationCtx) => {
      const row = await ctx.db
        .query("boardStrokes")
        .withIndex("by_sequence", (q) => q.eq("sequence", sequence))
        .unique();
      if (!row) throw new Error("seed row not found");
      // deletedAt (when it was deleted), not serverTimestamp (when it was
      // originally drawn) — pruning eligibility is based on the former.
      await ctx.db.patch(row._id, { deleted: true, deletedAt: Date.now() - ageMs });
    });
  }

  it("getAutoPruneEnabled defaults to false", async () => {
    expect(await t.query(api.boardAdmin.getAutoPruneEnabled, {})).toBe(false);
  });

  it("does nothing when autoPruneEnabled is off (the default)", async () => {
    await seedOldDeletedStroke(t, "old-one", 30 * 24 * 60 * 60 * 1000); // 30 days old
    await t.mutation(internal.boardAdmin.pruneDeletedStrokes, {});
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows).toHaveLength(1);
  });

  it("setAutoPruneEnabled requires a valid passcode", async () => {
    const wrong = await t.mutation(api.boardAdmin.setAutoPruneEnabled, { passcode: "wrong", enabled: true });
    expect(wrong.success).toBe(false);
    expect(await t.query(api.boardAdmin.getAutoPruneEnabled, {})).toBe(false);
  });

  it("once enabled, hard-deletes old soft-deleted rows but leaves recent or non-deleted ones", async () => {
    await t.mutation(api.boardAdmin.setAutoPruneEnabled, { passcode: PASSCODE, enabled: true });
    expect(await t.query(api.boardAdmin.getAutoPruneEnabled, {})).toBe(true);

    await seedOldDeletedStroke(t, "old-one", 30 * 24 * 60 * 60 * 1000); // old + deleted -> pruned
    const recent = await submitBoardStroke(t, "recent-deleted");
    await t.run(async (ctx: MutationCtx) => {
      const row = await ctx.db
        .query("boardStrokes")
        .withIndex("by_sequence", (q) => q.eq("sequence", recent.sequence))
        .unique();
      if (!row) throw new Error("seed row not found");
      await ctx.db.patch(row._id, { deleted: true, deletedAt: Date.now() }); // deleted just now -> not pruned yet
    });
    await submitBoardStroke(t, "still-live"); // never deleted -> never pruned

    await t.mutation(internal.boardAdmin.pruneDeletedStrokes, {});

    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.clientStrokeId === "old-one")).toBe(false);
    expect(rows.some((r) => r.clientStrokeId === "recent-deleted")).toBe(true);
    expect(rows.some((r) => r.clientStrokeId === "still-live")).toBe(true);
  });

  it("converges a prune backlog larger than BOARD_PRUNE_BATCH_SIZE over multiple bounded calls", async () => {
    await t.mutation(api.boardAdmin.setAutoPruneEnabled, { passcode: PASSCODE, enabled: true });
    const backlogSize = BOARD_PRUNE_BATCH_SIZE + 10;
    vi.useFakeTimers();
    try {
      for (let i = 0; i < backlogSize; i++) {
        await seedOldDeletedStroke(t, `old-${i}`, 30 * 24 * 60 * 60 * 1000);
        vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);
      }
    } finally {
      vi.useRealTimers();
    }
    let remaining = backlogSize;
    let calls = 0;
    while (remaining > 0) {
      await t.mutation(internal.boardAdmin.pruneDeletedStrokes, {});
      const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
      remaining = rows.length;
      calls++;
      if (calls > 10) throw new Error("did not converge");
    }
    expect(calls).toBeGreaterThan(1);
  });
});
