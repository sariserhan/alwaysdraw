// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { BOARD_WIPE_BATCH_SIZE, RATE_LIMIT_WINDOW_MS } from "./constants";

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
