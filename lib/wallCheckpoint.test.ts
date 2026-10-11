import { describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import { readWallCheckpoint, fetchWallCheckpoint, type WallCheckpoint } from "./wallCheckpoint";
import { packStrokes } from "./packedStrokes";
import { loadCanvasStateWithFallback } from "./loadCanvasState";
import type { ServerStroke } from "./types";

const stroke: ServerStroke = {
  clientId: "artist", clientStrokeId: "drawing", username: "Painter 🎨", countryCode: "TR",
  mode: "draw", brushType: "brush", color: "#ff0000", width: 4.75, opacity: 0.45,
  points: [{ x: 123.456789123, y: 987.654321987 }],
  tiles: ["tile_0_1"], clientTimestamp: 12, serverTimestamp: 13, sequence: 1,
};
const manifest: WallCheckpoint = { url: "https://example.com/wall", sequence: 1, strokeCount: 1, bytes: 100, createdAt: Date.now() };
const text = (rows: ServerStroke[] = [stroke]) => JSON.stringify({ version: 1, sequence: 1 }) + "\n" + JSON.stringify(packStrokes(rows)) + "\n";
function stream(raw: string, truncate = false) {
  const bytes = gzipSync(raw);
  const data = truncate ? bytes.subarray(0, bytes.length - 6) : bytes;
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      for (let i = 0; i < data.length; i += 7) controller.enqueue(new Uint8Array(data.subarray(i, i + 7)));
      controller.close();
    },
  });
}

describe("compressed vector checkpoint", () => {
  it("streams lossless vectors and Unicode owners across arbitrary chunk boundaries", async () => {
    const progress = vi.fn();
    expect(await readWallCheckpoint(stream(text()), manifest, () => false, progress))
      .toEqual({ strokes: [stroke], sequence: 1 });
    expect(progress).toHaveBeenLastCalledWith(1);
  });

  it("rejects truncation, incomplete pages, incorrect counts, versions and ordering", async () => {
    await expect(readWallCheckpoint(stream(text(), true), manifest, () => false, vi.fn())).rejects.toThrow();
    for (const raw of [text().trimEnd(), text([]), text().replace('"version":1', '"version":2'), text([stroke, stroke])]) {
      await expect(readWallCheckpoint(stream(raw), manifest, () => false, vi.fn())).rejects.toThrow();
    }
  });

  it("handles empty walls and cancellation without exposing partial data", async () => {
    expect(await readWallCheckpoint(stream(text([])), { ...manifest, strokeCount: 0 }, () => false, vi.fn()))
      .toEqual({ strokes: [], sequence: 1 });
    expect(await readWallCheckpoint(stream(text()), manifest, () => true, vi.fn())).toBeNull();
  });

  it("does not fetch missing or expired checkpoints", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      expect(await fetchWallCheckpoint(null, () => false, vi.fn())).toBeNull();
      expect(await fetchWallCheckpoint({ ...manifest, createdAt: Date.now() - 31 * 60_000 }, () => false, vi.fn())).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    } finally { fetcher.mockRestore(); }
  });

  it("catches concurrent deletion and new strokes before revealing a cached wall", async () => {
    const packed = vi.fn();
    const page = vi.fn();
    const range = vi.fn(async ({ afterSequence }: { afterSequence: number }) => afterSequence === 1
      ? [{ ...stroke, sequence: 2, deleted: true }, { ...stroke, clientStrokeId: "new", sequence: 3 }]
      : [{ ...stroke, clientStrokeId: "eraser", mode: "erase" as const, sequence: 4 }]);
    const heads = vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    const state = await loadCanvasStateWithFallback(heads, range, page, () => false, vi.fn(), undefined, packed,
      async () => ({ strokes: [stroke], sequence: 1 }));
    expect(state?.strokes.map(s => s.clientStrokeId)).toEqual(["new", "eraser"]);
    expect(state?.sequence).toBe(4);
    expect(range.mock.calls[0][0].afterSequence).toBe(1);
    expect(packed).not.toHaveBeenCalled();
    expect(page).not.toHaveBeenCalled();
  });

  it.each(["failure", "too old", "ahead"])("falls back to packed queries for a checkpoint that is %s", async (kind) => {
    const packed = vi.fn(async () => [stroke]);
    const state = await loadCanvasStateWithFallback(async () => kind === "too old" ? 21000 : 1,
      async () => [], vi.fn(), () => false, vi.fn(), undefined, packed, async () => {
        if (kind === "failure") throw new Error("Download failed");
        return { strokes: [stroke], sequence: kind === "ahead" ? 2 : 1 };
      });
    expect(state?.strokes).toEqual([stroke]);
    expect(packed).toHaveBeenCalled();
  });
});
