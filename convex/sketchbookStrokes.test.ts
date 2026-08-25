// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH, SKETCHBOOK_STROKES_PER_CLIENT_WINDOW } from "./constants";
import { SKETCHBOOK_PAGES } from "../lib/sketchbookPages";
import type { StrokeMode, Point, BrushType } from "../lib/types";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseArgs = {
  clientId: "anon-tester",
  mode: "draw" as StrokeMode,
  pageId: "geisha",
  regionId: "canvas",
  color: "#e0432b",
  width: 8,
  opacity: 1,
  points: [{ x: 100, y: 100 }] as Point[],
  clientTimestamp: 0,
};

function strokeArgs(
  overrides: Partial<typeof baseArgs> & { clientStrokeId: string; brushType?: BrushType },
) {
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

  it("rejects an Object.prototype key as pageId (e.g. 'constructor')", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "bad-proto-page", pageId: "constructor" })),
    ).rejects.toThrow(/unknown pageId/);
  });

  it("rejects an unknown regionId", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "bad-region", regionId: "not-a-region" })),
    ).rejects.toThrow();
  });

  // ponytail: every current page is free-form with a single region id
  // ("canvas"), so there's no longer a real regionId that's valid on one
  // page but not another to construct this case with — the "unknown
  // regionId" test above already covers the underlying check
  // (page.regions.some(...)), which is inherently scoped per page.

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
    const { width, height } = SKETCHBOOK_PAGES.geisha!;
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

    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "geisha", afterSequence: 0 });
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
    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "geisha", afterSequence: first.sequence });
    expect(rows.map((r) => r.clientStrokeId)).toEqual(["seq-2"]);
  });

  it("rejects an unknown pageId", async () => {
    await expect(
      t.query(api.sketchbookStrokes.listSince, { pageId: "not-a-page", afterSequence: 0 }),
    ).rejects.toThrow();
  });

  it("never returns strokes submitted under a different pageId", async () => {
    await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "geisha-1" }));
    await t.mutation(
      api.sketchbookStrokes.submit,
      strokeArgs({ clientStrokeId: "chess-1", pageId: "chess" }),
    );

    const geishaRows = await t.query(api.sketchbookStrokes.listSince, { pageId: "geisha", afterSequence: 0 });
    const chessRows = await t.query(api.sketchbookStrokes.listSince, { pageId: "chess", afterSequence: 0 });

    expect(geishaRows.map((r) => r.clientStrokeId)).toEqual(["geisha-1"]);
    expect(chessRows.map((r) => r.clientStrokeId)).toEqual(["chess-1"]);
  });
});

describe("sketchbookStrokes.submit — brushType", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("defaults brushType to 'brush' for a draw stroke when omitted", async () => {
    await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "brush-default" }));
    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "geisha", afterSequence: 0 });
    expect(rows.find((r) => r.clientStrokeId === "brush-default")?.brushType).toBe("brush");
  });

  it("stores an explicit brushType for a draw stroke", async () => {
    await t.mutation(
      api.sketchbookStrokes.submit,
      strokeArgs({ clientStrokeId: "brush-watercolor", brushType: "watercolor" }),
    );
    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "geisha", afterSequence: 0 });
    expect(rows.find((r) => r.clientStrokeId === "brush-watercolor")?.brushType).toBe("watercolor");
  });

  it("never stores a brushType for an erase stroke, even if one is sent", async () => {
    await t.mutation(
      api.sketchbookStrokes.submit,
      strokeArgs({ clientStrokeId: "erase-1", mode: "erase", brushType: "watercolor" }),
    );
    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "geisha", afterSequence: 0 });
    expect(rows.find((r) => r.clientStrokeId === "erase-1")?.brushType).toBeUndefined();
  });
});
