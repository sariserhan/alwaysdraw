// @vitest-environment edge-runtime
import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { packStrokes, unpackStrokes } from "./packedStrokes";
import { loadCanvasStateWithFallback } from "./loadCanvasState";
import type { ServerStroke } from "./types";

const modules = Object.fromEntries(Object.entries(import.meta.glob("../convex/**/*.*s"))
  .filter(([path]) => !path.endsWith(".test.ts")));
const stroke: ServerStroke = {
  clientId: "artist", clientStrokeId: "drawing", username: "Painter", countryCode: "TR",
  mode: "draw", brushType: "brush", color: "#ff0000", width: 4.75, opacity: 0.45,
  points: [{ x: 123.456789123, y: 987.654321987 }, { x: 100, y: 200 }],
  tiles: ["tile_0_1"], clientTimestamp: 12, serverTimestamp: 13, sequence: 1,
};

describe("lossless compact wall loading", () => {
  it("preserves precise vectors, owners, styles, erasers and omitted legacy fields", () => {
    const legacy = { ...stroke, clientStrokeId: "legacy", sequence: 3 };
    delete legacy.username; delete legacy.countryCode; delete legacy.brushType;
    delete legacy.opacity; delete legacy.tiles;
    const rows: ServerStroke[] = [stroke, { ...stroke, clientStrokeId: "second", sequence: 2 }, legacy,
      { ...legacy, clientStrokeId: "eraser", sequence: 4, mode: "erase" }];
    const packed = packStrokes(rows);
    expect(packed.styles).toHaveLength(3);
    expect(unpackStrokes(packed)).toEqual(rows);
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(rows).length);
  });

  it("queries active rows, preserves precision, and catches deletions during loading", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run(async (ctx) => {
      const id = await ctx.db.insert("strokes", stroke);
      await ctx.db.insert("strokes", { ...stroke, clientStrokeId: "second", sequence: 2, deleted: false });
      await ctx.db.insert("strokes", { ...stroke, clientStrokeId: "removed", sequence: 3, deleted: true });
      return id;
    });
    const packed = await t.query(api.strokes.listCurrentPacked, { afterSequence: 0, throughSequence: 3 });
    expect(unpackStrokes(packed).map(s => s.clientStrokeId)).toEqual(["drawing", "second"]);
    expect(unpackStrokes(packed)[0]).toEqual(stroke);
    let heads = 0;
    const state = await loadCanvasStateWithFallback(async () => {
      if (++heads === 2) await t.run(ctx => ctx.db.patch(id, { deleted: true, sequence: 4 }));
      return t.query(api.strokes.getHead, {});
    }, args => t.query(api.strokes.listRange, args), vi.fn(), () => false, vi.fn(), vi.fn(),
    async args => unpackStrokes(await t.query(api.strokes.listCurrentPacked, args)));
    expect(state?.strokes.map(s => s.clientStrokeId)).toEqual(["second"]);
    expect(state?.sequence).toBe(4);
    await expect(t.query(api.strokes.listCurrentPacked, { afterSequence: -1, throughSequence: 3 }))
      .rejects.toThrow("invalid stroke sequence range");
  });

  it("falls back to current rows when the compact API is unavailable", async () => {
    const history = vi.fn();
    const state = await loadCanvasStateWithFallback(async () => 1, vi.fn(), history, () => false,
      vi.fn(), async () => [stroke], async () => { throw new Error("Not deployed yet"); });
    expect(state?.strokes).toEqual([stroke]);
    expect(history).not.toHaveBeenCalled();
  });
});
