// @vitest-environment edge-runtime
import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { loadCanvasState, loadCanvasStateWithFallback } from "./loadCanvasState";
import type { ServerStrokeRow } from "./types";

const allModules = import.meta.glob("../convex/**/*.*s");
const modules = Object.fromEntries(Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")));
const stroke = (sequence: number): ServerStrokeRow => ({
  sequence, clientStrokeId: `stroke-${sequence}`, clientId: "artist",
  mode: "draw", color: "#ff0000", width: 8,
  points: [{ x: 10, y: 10 }], clientTimestamp: sequence, serverTimestamp: sequence,
});

describe("current canvas state", () => {
  it("loads dense current-state windows across gaps and applies catch-up tombstones", async () => {
    const active = Array.from({ length: 12000 }, (_, i) => stroke(i + 1));
    active.push(stroke(45000));
    const heads = vi.fn().mockResolvedValueOnce(50000).mockResolvedValueOnce(50001);
    const current = vi.fn(async ({ afterSequence, throughSequence }) =>
      active.filter((row) => row.sequence > afterSequence && row.sequence <= throughSequence).slice(0, 1000));
    const state = await loadCanvasState(heads, async () => [
      { ...stroke(1), sequence: 50001, deleted: true },
    ], () => false, vi.fn(), current);
    expect(state?.strokes).toHaveLength(12000);
    expect(state?.strokes[0].sequence).toBe(2);
    expect(state?.strokes.at(-1)?.sequence).toBe(45000);
    expect(state?.sequence).toBe(50001);
    expect(current.mock.calls.some(([args]) => args.afterSequence === 1000)).toBe(true);
    expect(current.mock.calls.some(([args]) => args.afterSequence === 40000)).toBe(true);
  });

  it.each(["strokes", "boardStrokes"] as const)("loads %s across sequence gaps and catches concurrent deletions", async (table) => {
    const t = convexTest(schema, modules);
    const queries = api[table];
    const ids = await t.run(async (ctx) => {
      await ctx.db.insert(table, { ...stroke(2000), deleted: true });
      await ctx.db.insert(table, { ...stroke(2001), deleted: false });
      const ids = [];
      for (const seq of [1, 1000, 1001, 3002]) ids.push(await ctx.db.insert(table, stroke(seq)));
      return ids;
    });
    let heads = 0;
    const state = await loadCanvasState(async () => {
      if (++heads === 2) {
        await t.run(async (ctx) => {
          await ctx.db.patch(ids[0], { sequence: 3003, deleted: true, deletedAt: 1 });
          await ctx.db.insert(table, { ...stroke(3004), mode: "erase" });
        });
      }
      return t.query(queries.getHead, {});
    }, (args) => t.query(queries.listRange, args), () => false, vi.fn(),
      (args) => t.query(queries.listCurrent, args));
    expect(state?.strokes.map((row) => row.sequence)).toEqual([1000, 1001, 2001, 3002, 3004]);
    expect(state?.strokes.at(-1)?.mode).toBe("erase");
    expect(state?.sequence).toBe(3004);
    await expect(t.query(queries.listRange, { afterSequence: 0, throughSequence: 1001 })).rejects.toThrow("invalid stroke sequence range");
  });

  it("loads four ranges concurrently but exposes no partial state", async () => {
    const pending: Array<() => void> = [];
    const fetchRange = vi.fn(({ throughSequence }: { afterSequence: number; throughSequence: number }) =>
      new Promise<ServerStrokeRow[]>((resolve) => pending.push(() => resolve([stroke(throughSequence)]))),
    );
    let complete = false;
    const loading = loadCanvasState(async () => 4000, fetchRange, () => false).then((state) => {
      complete = true;
      return state;
    });
    await Promise.resolve();
    expect(fetchRange).toHaveBeenCalledTimes(4);
    pending[3](); pending[1](); pending[2]();
    await Promise.resolve();
    expect(complete).toBe(false);
    pending[0]();
    expect((await loading)?.strokes.map((row) => row.sequence)).toEqual([1000, 2000, 3000, 4000]);
  });

  it("discards cancelled loads and never returns incomplete data on failure", async () => {
    let cancelled = false;
    expect(await loadCanvasState(async () => 1, async () => {
      cancelled = true;
      return [stroke(1)];
    }, () => cancelled)).toBeNull();
    await expect(loadCanvasState(async () => 2000, async ({ afterSequence }) => {
      if (afterSequence > 0) throw new Error("offline");
      return [stroke(1)];
    }, () => false)).rejects.toThrow("offline");
  });

  it("handles an empty wall without range requests", async () => {
    const fetchRange = vi.fn();
    expect(await loadCanvasState(async () => 0, fetchRange, () => false)).toEqual({ strokes: [], sequence: 0 });
    expect(fetchRange).not.toHaveBeenCalled();
  });
});


describe("backward-compatible wall loading", () => {
  it("uses the existing API when the new backend queries are unavailable", async () => {
    const pages = vi.fn().mockResolvedValueOnce(Array.from({ length: 1000 }, (_, i) => stroke(i + 1)))
      .mockResolvedValueOnce([{ ...stroke(1), sequence: 1001, deleted: true }, { ...stroke(1002), mode: "erase" }]);
    const progress = vi.fn();
    const state = await loadCanvasStateWithFallback(async () => { throw new Error("Server Error"); }, vi.fn(), pages, () => false, progress);
    expect(state?.sequence).toBe(1002);
    expect(state?.strokes).toHaveLength(1000);
    expect(state?.strokes.some(s => s.clientStrokeId === "stroke-1")).toBe(false);
    expect(state?.strokes.at(-1)?.mode).toBe("erase");
    expect(progress).toHaveBeenLastCalledWith(1002);
    expect(pages.mock.calls[1][0].afterSequence).toBe(1000);
  });

  it("times out stalled requests instead of remaining in loading forever", async () => {
    vi.useFakeTimers();
    try {
      const stalled = () => new Promise<never>(() => {});
      const loading = loadCanvasStateWithFallback(stalled, stalled, stalled, () => false);
      const assertion = expect(loading).rejects.toThrow("Wall request timed out");
      await vi.advanceTimersByTimeAsync(30_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
