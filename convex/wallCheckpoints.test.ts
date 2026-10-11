import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { gunzipSync } from "node:zlib";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = Object.fromEntries(Object.entries(import.meta.glob("./**/*.*s"))
  .filter(([path]) => !path.endsWith(".test.ts")));
const row = {
  clientId: "artist", clientStrokeId: "drawing", username: "Painter", mode: "draw" as const,
  color: "#ff0000", width: 4, points: [{ x: 123.456789, y: 456.789123 }],
  clientTimestamp: 12, serverTimestamp: 13, sequence: 1,
};

describe("wall checkpoint publication", () => {
  it("builds a compressed active-vector file and skips rebuilding an unchanged wall", async () => {
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      await ctx.db.insert("strokes", row);
      await ctx.db.insert("strokes", { ...row, clientStrokeId: "removed", sequence: 2, deleted: true });
    });
    await t.action(internal.buildWallCheckpoint.build, {});
    const manifest = await t.query(api.wallCheckpoints.latest, {});
    expect(manifest?.sequence).toBe(2);
    expect(manifest?.strokeCount).toBe(1);
    const stored = await t.run(async ctx => {
      const saved = await ctx.db.query("wallCheckpoints").first();
      return (await ctx.storage.get(saved!.storageId))!.arrayBuffer();
    });
    const lines = gunzipSync(Buffer.from(stored)).toString().trim().split("\n").map(s => JSON.parse(s));
    expect(lines[0]).toEqual({ version: 1, sequence: 2 });
    expect(lines[1].strokes[0].xy).toEqual([123.456789, 456.789123]);
    expect(lines[1].styles[0].username).toBe("Painter");
    await t.action(internal.buildWallCheckpoint.build, {});
    expect((await t.query(api.wallCheckpoints.latest, {}))?.url).toBe(manifest?.url);
  });

  it("allows only one builder, ignores expired ownership, and hides stale checkpoints", async () => {
    const t = convexTest(schema, modules);
    expect(await t.mutation(internal.wallCheckpoints.begin, { token: "first", sequence: 1 })).toBe(true);
    expect(await t.mutation(internal.wallCheckpoints.begin, { token: "second", sequence: 1 })).toBe(false);
    await t.mutation(internal.wallCheckpoints.release, { token: "second" });
    expect(await t.mutation(internal.wallCheckpoints.begin, { token: "second", sequence: 1 })).toBe(false);
    await t.mutation(internal.wallCheckpoints.release, { token: "first" });
    const storageId = await t.run(ctx => ctx.storage.store(new Blob(["old"])));
    await t.mutation(internal.wallCheckpoints.finish, { token: "first", sequence: 1, storageId, bytes: 3, strokeCount: 1 });
    expect(await t.query(api.wallCheckpoints.latest, {})).toBeNull();
    await t.run(async ctx => {
      const storageId = await ctx.storage.store(new Blob(["stale"]));
      await ctx.db.insert("wallCheckpoints", { sequence: 1, storageId, bytes: 5, strokeCount: 1, createdAt: Date.now() - 31 * 60_000 });
    });
    expect(await t.query(api.wallCheckpoints.latest, {})).toBeNull();
  });
});
