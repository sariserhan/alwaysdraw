// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH, SKETCHBOOK_STROKES_PER_CLIENT_WINDOW } from "./constants";
import { SKETCHBOOK_PAGES } from "../lib/sketchbookPages";
import type { StrokeMode, Point } from "../lib/types";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseArgs = {
  clientId: "anon-tester",
  mode: "draw" as StrokeMode,
  pageId: "flower",
  regionId: "center",
  color: "#e0432b",
  width: 8,
  opacity: 1,
  points: [{ x: 400, y: 400 }] as Point[],
  clientTimestamp: 0,
};

function strokeArgs(overrides: Partial<typeof baseArgs> & { clientStrokeId: string }) {
  return { ...baseArgs, ...overrides };
}

describe("sketchbookStrokes.submit — validation boundaries", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("accepts a valid stroke and returns a sequence", async () => {
    const result = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "ok-1" }));
    expect(result.sequence).toBeGreaterThan(0);
  });

  it("rejects an unknown pageId", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "bad-page", pageId: "not-a-page" })),
    ).rejects.toThrow();
  });

  it("rejects an unknown regionId", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "bad-region", regionId: "not-a-region" })),
    ).rejects.toThrow();
  });

  it("rejects a regionId that belongs to a different page", async () => {
    await expect(
      t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({ clientStrokeId: "cross-page-region", pageId: "circle", regionId: "petal-1" }),
      ),
    ).rejects.toThrow();
  });

  it("rejects width below the minimum, accepts width at the minimum", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "w-lo", width: MIN_BRUSH_WIDTH - 1 })),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "w-ok", width: MIN_BRUSH_WIDTH })),
    ).resolves.toBeDefined();
  });

  it("rejects width above the maximum", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "w-hi", width: MAX_BRUSH_WIDTH + 1 })),
    ).rejects.toThrow();
  });

  it("rejects coordinates outside the page bounds", async () => {
    const { width, height } = SKETCHBOOK_PAGES.flower;
    await expect(
      t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({ clientStrokeId: "oob", points: [{ x: width + 1, y: height }] }),
      ),
    ).rejects.toThrow();
  });

  it("rejects a malformed color", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "c-bad", color: "not-a-color" })),
    ).rejects.toThrow();
  });

  it("rate limits excessive chunks from one anonymous client", async () => {
    for (let i = 0; i < SKETCHBOOK_STROKES_PER_CLIENT_WINDOW; i++) {
      await t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({ clientStrokeId: `rate-${i}`, clientId: "rate-client" }),
      );
    }
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "rate-over", clientId: "rate-client" })),
    ).rejects.toThrow(/rate limit/);
  });
});

describe("sketchbookStrokes.submit — idempotency and sequencing", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns the same sequence and inserts only once on a retried clientStrokeId", async () => {
    const first = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "dup-1" }));
    const second = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "dup-1" }));
    expect(second.sequence).toBe(first.sequence);

    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "flower", afterSequence: 0 });
    expect(rows.filter((r) => r.clientStrokeId === "dup-1")).toHaveLength(1);
  });
});

describe("sketchbookStrokes.listSince", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns only strokes after the given sequence", async () => {
    const first = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "seq-1" }));
    await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "seq-2" }));
    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "flower", afterSequence: first.sequence });
    expect(rows.map((r) => r.clientStrokeId)).toEqual(["seq-2"]);
  });

  it("rejects an unknown pageId", async () => {
    await expect(
      t.query(api.sketchbookStrokes.listSince, { pageId: "not-a-page", afterSequence: 0 }),
    ).rejects.toThrow();
  });

  it("never returns strokes submitted under a different pageId", async () => {
    await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "flower-1" }));
    await t.mutation(
      api.sketchbookStrokes.submit,
      strokeArgs({ clientStrokeId: "circle-1", pageId: "circle", regionId: "circle" }),
    );

    const flowerRows = await t.query(api.sketchbookStrokes.listSince, { pageId: "flower", afterSequence: 0 });
    const circleRows = await t.query(api.sketchbookStrokes.listSince, { pageId: "circle", afterSequence: 0 });

    expect(flowerRows.map((r) => r.clientStrokeId)).toEqual(["flower-1"]);
    expect(circleRows.map((r) => r.clientStrokeId)).toEqual(["circle-1"]);
  });
});
