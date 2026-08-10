// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { PRESENCE_ONLINE_WINDOW_MS } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("presence.onlineCount — cached counter", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns 0 before the cron has ever run", async () => {
    await t.mutation(api.presence.heartbeat, { clientId: "a", cursorX: 1, cursorY: 1 });
    expect(await t.query(api.presence.onlineCount, {})).toBe(0);
  });

  it("reflects the number of clients seen within the online window after a recompute", async () => {
    await t.mutation(api.presence.heartbeat, { clientId: "a", cursorX: 1, cursorY: 1 });
    await t.mutation(api.presence.heartbeat, { clientId: "b", cursorX: 2, cursorY: 2 });
    await t.mutation(api.presence.heartbeat, { clientId: "c", cursorX: 3, cursorY: 3 });
    await t.mutation(internal.presence.recomputeOnlineCount, {});
    expect(await t.query(api.presence.onlineCount, {})).toBe(3);
  });

  it("updates the same singleton row on repeated recomputes, not a new one each time", async () => {
    await t.mutation(api.presence.heartbeat, { clientId: "a", cursorX: 1, cursorY: 1 });
    await t.mutation(internal.presence.recomputeOnlineCount, {});
    await t.mutation(api.presence.heartbeat, { clientId: "b", cursorX: 2, cursorY: 2 });
    await t.mutation(internal.presence.recomputeOnlineCount, {});
    expect(await t.query(api.presence.onlineCount, {})).toBe(2);

    // presenceStats is a singleton by design — take(2) proves "still exactly one row" without an unbounded collect().
    const rowCount = await t.run(async (ctx) => (await ctx.db.query("presenceStats").take(2)).length);
    expect(rowCount).toBe(1);
  });

  it("stores and lists remote laserTrail data", async () => {
    await t.mutation(api.presence.heartbeat, {
      clientId: "laserGuy",
      cursorX: 100,
      cursorY: 200,
      laserTrail: [{ x: 100, y: 200, timestamp: 1000 }],
    });
    const list = await t.query(api.presence.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].laserTrail).toEqual([{ x: 100, y: 200, timestamp: 1000 }]);
  });
});

describe("presence.onlineCount — staleness window", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.useFakeTimers();
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes a client that's aged out of the online window", async () => {
    await t.mutation(api.presence.heartbeat, { clientId: "old", cursorX: 1, cursorY: 1 });
    vi.advanceTimersByTime(PRESENCE_ONLINE_WINDOW_MS + 1000);
    await t.mutation(api.presence.heartbeat, { clientId: "fresh", cursorX: 2, cursorY: 2 });

    await t.mutation(internal.presence.recomputeOnlineCount, {});
    expect(await t.query(api.presence.onlineCount, {})).toBe(1);
  });
});
