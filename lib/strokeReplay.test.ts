// @vitest-environment edge-runtime
import { describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import { replayStrokePages } from "./strokeReplay";
import type { ServerStrokeRow } from "./types";

const allModules = import.meta.glob("../convex/**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("saved stroke replay", () => {
  it("recovers history across pages despite incomplete snapshots, preserving erases and deletions", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let sequence = 1; sequence <= 1002; sequence++) {
        await ctx.db.insert("strokes", {
          clientStrokeId: `stroke-${sequence}`,
          clientId: "saved-artist",
          sequence,
          mode: sequence === 1001 ? "erase" : "draw",
          color: "#e0432b",
          width: 8,
          points: [{ x: sequence, y: 10 }],
          clientTimestamp: sequence,
          serverTimestamp: sequence,
          ...(sequence === 1002 ? { deleted: true, deletedAt: sequence } : {}),
        });
      }
      // Represents a later-generation snapshot that omitted older artwork.
      await ctx.db.insert("snapshots", {
        sequence: 1000,
        imageData: "data:image/png;base64,aW5jb21wbGV0ZQ==",
        strokeCount: 500,
        createdAt: 1,
      });
    });

    // Reopening the canvas must recover the same saved history every time.
    for (let visit = 0; visit < 2; visit++) {
      const fetchPage = vi.fn((args: { afterSequence: number; limit: number }) =>
        t.query(api.strokes.listSince, args),
      );
      const rows: ServerStrokeRow[] = [];
      for await (const page of replayStrokePages(fetchPage, () => false)) rows.push(...page);

      expect(fetchPage.mock.calls.map(([args]) => args.afterSequence)).toEqual([0, 1000]);
      expect(rows).toHaveLength(1002);
      expect(rows[0].clientStrokeId).toBe("stroke-1");
      expect(rows[999].clientStrokeId).toBe("stroke-1000");
      expect(rows[1000].mode).toBe("erase");
      expect(rows[1001].deleted).toBe(true);
    }
  });

  it("discards a page that arrives after unmount", async () => {
    let cancelled = false;
    const fetchPage = vi.fn(async () => {
      cancelled = true;
      return [{ sequence: 1 } as ServerStrokeRow];
    });
    const pages = [];
    for await (const page of replayStrokePages(fetchPage, () => cancelled)) pages.push(page);
    expect(pages).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("propagates loading failures instead of marking an incomplete replay successful", async () => {
    const failure = new Error("connection lost");
    const replay = replayStrokePages(async () => { throw failure; }, () => false);
    await expect(replay.next()).rejects.toBe(failure);
  });
});
