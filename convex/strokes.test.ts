// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MIN_BRUSH_WIDTH,
  MAX_BRUSH_WIDTH,
  MIN_OPACITY,
  MAX_OPACITY,
  MAX_CLIENT_ID_LENGTH,
  MAX_CLIENT_STROKE_ID_LENGTH,
  STROKES_PER_CLIENT_WINDOW,
} from "./constants";
import type { StrokeMode, BrushType, Point } from "../lib/types";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseArgs = {
  clientId: "anon-tester",
  mode: "draw" as StrokeMode,
  brushType: "brush" as BrushType | undefined,
  color: "#e0432b",
  width: 8,
  opacity: 1,
  points: [{ x: 10, y: 10 }] as Point[],
  clientTimestamp: 0,
};

function strokeArgs(overrides: Partial<typeof baseArgs> & { clientStrokeId: string }) {
  return { ...baseArgs, ...overrides };
}

describe("strokes.submit — validation boundaries", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("rejects width below the minimum, accepts width at the minimum", async () => {
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "w-lo", width: MIN_BRUSH_WIDTH - 1 })),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "w-ok", width: MIN_BRUSH_WIDTH })),
    ).resolves.toBeDefined();
  });

  it("rejects width above the maximum, accepts width at the maximum", async () => {
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "w-hi", width: MAX_BRUSH_WIDTH + 1 })),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "w-ok2", width: MAX_BRUSH_WIDTH })),
    ).resolves.toBeDefined();
  });

  it("rejects an empty points array", async () => {
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "p-empty", points: [] })),
    ).rejects.toThrow();
  });

  it("rejects more than 100 points in one chunk", async () => {
    const points = Array.from({ length: 101 }, (_, i) => ({ x: i, y: i }));
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "p-many", points })),
    ).rejects.toThrow();
  });

  it("rejects NaN and Infinity coordinates", async () => {
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "nan", points: [{ x: NaN, y: 1 }] }),
      ),
    ).rejects.toThrow();
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "inf", points: [{ x: Infinity, y: 1 }] }),
      ),
    ).rejects.toThrow();
  });

  it("rejects coordinates outside the world bounds", async () => {
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "oob-neg", points: [{ x: -1, y: 0 }] }),
      ),
    ).rejects.toThrow();
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "oob-big", points: [{ x: WORLD_WIDTH + 1, y: WORLD_HEIGHT }] }),
      ),
    ).rejects.toThrow();
  });

  it("rejects a malformed color and accepts hex/rgb/rgba", async () => {
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "c-bad", color: "not-a-color" })),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "c-hex", color: "#fff" })),
    ).resolves.toBeDefined();
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "c-rgba", color: "rgba(224, 67, 43, 0.5)" }),
      ),
    ).resolves.toBeDefined();
  });

  it("rejects opacity outside [MIN_OPACITY, MAX_OPACITY]", async () => {
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "o-lo", opacity: MIN_OPACITY - 0.01 }),
      ),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "o-hi", opacity: MAX_OPACITY + 0.01 })),
    ).rejects.toThrow();
  });

  it("defaults opacity to 1 when omitted", async () => {
    await t.mutation(api.strokes.submit, {
      clientId: baseArgs.clientId,
      mode: baseArgs.mode,
      brushType: baseArgs.brushType,
      color: baseArgs.color,
      width: baseArgs.width,
      points: baseArgs.points,
      clientTimestamp: baseArgs.clientTimestamp,
      clientStrokeId: "o-default",
    });
    const rows = await t.query(api.strokes.listSince, { afterSequence: 0 });
    const row = rows.find((r) => r.clientStrokeId === "o-default");
    expect(row?.opacity).toBe(1);
  });

  it("rejects empty or oversized anonymous identifiers", async () => {
    await expect(
      t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "", clientId: "anon" })),
    ).rejects.toThrow(/clientStrokeId/);
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({
          clientStrokeId: "x".repeat(MAX_CLIENT_STROKE_ID_LENGTH + 1),
          clientId: "anon",
        }),
      ),
    ).rejects.toThrow(/clientStrokeId/);
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({
          clientStrokeId: "valid-id",
          clientId: "x".repeat(MAX_CLIENT_ID_LENGTH + 1),
        }),
      ),
    ).rejects.toThrow(/clientId/);
  });

  it("rejects a non-finite client timestamp", async () => {
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "bad-time", clientTimestamp: Infinity }),
      ),
    ).rejects.toThrow(/clientTimestamp/);
  });

  it("rate limits excessive chunks from one anonymous client", async () => {
    for (let i = 0; i < STROKES_PER_CLIENT_WINDOW; i++) {
      await t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: `rate-${i}`, clientId: "rate-client" }),
      );
    }
    await expect(
      t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: "rate-over", clientId: "rate-client" }),
      ),
    ).rejects.toThrow(/rate limit/);
  });
});

describe("strokes.submit — idempotency and sequencing", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns the same sequence and inserts only once on a retried clientStrokeId", async () => {
    const first = await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "dup-1" }));
    const second = await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "dup-1" }));
    expect(second.sequence).toBe(first.sequence);

    const rows = await t.query(api.strokes.listSince, { afterSequence: 0 });
    expect(rows.filter((r) => r.clientStrokeId === "dup-1")).toHaveLength(1);
  });

  it("hands out a gapless, strictly increasing sequence across many submits", async () => {
    const n = 20;
    const sequences: number[] = [];
    for (let i = 0; i < n; i++) {
      const { sequence } = await t.mutation(
        api.strokes.submit,
        strokeArgs({ clientStrokeId: `seq-${i}` }),
      );
      sequences.push(sequence);
    }
    const sorted = [...sequences].sort((a, b) => a - b);
    expect(sequences).toEqual(sorted); // already increasing in submission order
    expect(new Set(sequences).size).toBe(n); // no duplicates
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]).toBe(sorted[i - 1] + 1); // no gaps
    }
  });

  it("hands out distinct sequences with no duplicates under concurrent submits", async () => {
    const n = 15;
    const results = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: `concurrent-${i}` })),
      ),
    );
    const sequences = results.map((r) => r.sequence);
    expect(new Set(sequences).size).toBe(n);
  });
});

describe("strokes.listSince — replay ordering and pagination", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns strokes in ascending sequence order", async () => {
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: `order-${i}` }));
    }
    const rows = await t.query(api.strokes.listSince, { afterSequence: 0 });
    const sequences = rows.map((r) => r.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
  });

  it("only returns strokes after the given sequence", async () => {
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: `after-${i}` }));
    }
    const all = await t.query(api.strokes.listSince, { afterSequence: 0 });
    const cutoff = all[1].sequence;
    const rows = await t.query(api.strokes.listSince, { afterSequence: cutoff });
    expect(rows.every((r) => r.sequence > cutoff)).toBe(true);
    expect(rows).toHaveLength(all.length - 2);
  });

  it("paging through with each page's last sequence covers every stroke exactly once", async () => {
    const total = 9;
    for (let i = 0; i < total; i++) {
      await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: `page-${i}` }));
    }
    const seen: number[] = [];
    let after = 0;
    for (;;) {
      const page = await t.query(api.strokes.listSince, { afterSequence: after, limit: 4 });
      if (page.length === 0) break;
      seen.push(...page.map((r) => r.sequence));
      after = page[page.length - 1].sequence;
    }
    expect(new Set(seen).size).toBe(total); // no duplicates across pages
    expect(seen).toEqual([...seen].sort((a, b) => a - b)); // still globally ordered
  });

  it("preserves draw-then-erase order, so an erase reliably lands after the stroke it erases", async () => {
    await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "draw-a" }));
    await t.mutation(
      api.strokes.submit,
      strokeArgs({ clientStrokeId: "erase-a", mode: "erase", brushType: undefined }),
    );
    const rows = await t.query(api.strokes.listSince, { afterSequence: 0 });
    const drawIndex = rows.findIndex((r) => r.clientStrokeId === "draw-a");
    const eraseIndex = rows.findIndex((r) => r.clientStrokeId === "erase-a");
    expect(drawIndex).toBeGreaterThanOrEqual(0);
    expect(eraseIndex).toBeGreaterThan(drawIndex);
  });
});

describe("strokes.listRecent — live tail", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns the most recent N strokes in ascending sequence order", async () => {
    for (let i = 0; i < 10; i++) {
      await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: `recent-${i}` }));
    }
    const rows = await t.query(api.strokes.listRecent, { limit: 3 });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.clientStrokeId)).toEqual(["recent-7", "recent-8", "recent-9"]);
    const sequences = rows.map((r) => r.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
  });
});

describe("strokes.listByTiles — spatial query filtering", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("filters strokes matching the requested visible tile keys", async () => {
    await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "tile-a", points: [{ x: 100, y: 100 }] }));
    await t.mutation(api.strokes.submit, strokeArgs({ clientStrokeId: "tile-b", points: [{ x: 5000, y: 5000 }] }));

    const tileA = await t.query(api.strokes.listByTiles, { tileKeys: ["tile_0_0"] });
    expect(tileA.some((r) => r.clientStrokeId === "tile-a")).toBe(true);
    expect(tileA.some((r) => r.clientStrokeId === "tile-b")).toBe(false);

    const tileB = await t.query(api.strokes.listByTiles, { tileKeys: ["tile_10_10"] });
    expect(tileB.some((r) => r.clientStrokeId === "tile-b")).toBe(true);
    expect(tileB.some((r) => r.clientStrokeId === "tile-a")).toBe(false);
  });
});
