// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { BOARD_MAX_PRESENCE_LIST } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("boardPresence.heartbeat", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("accepts a valid heartbeat and countryCode is listed back", async () => {
    await t.mutation(api.boardPresence.heartbeat, {
      clientId: "a",
      countryCode: "JP",
      cursorX: 10,
      cursorY: 10,
    });
    const list = await t.query(api.boardPresence.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].countryCode).toBe("JP");
  });

  it("rejects a username containing a blocked word", async () => {
    await expect(
      t.mutation(api.boardPresence.heartbeat, { clientId: "a", username: "fuck", cursorX: 1, cursorY: 1 }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
  });

  it("clamps cursor coordinates to board bounds rather than rejecting", async () => {
    await t.mutation(api.boardPresence.heartbeat, { clientId: "a", cursorX: 999999, cursorY: -50 });
    const list = await t.query(api.boardPresence.list, {});
    expect(list[0].cursorX).toBeLessThanOrEqual(2400);
    expect(list[0].cursorY).toBeGreaterThanOrEqual(0);
  });
});

describe("boardPresence.list", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("never returns more than BOARD_MAX_PRESENCE_LIST rows", async () => {
    for (let i = 0; i < BOARD_MAX_PRESENCE_LIST + 5; i++) {
      await t.mutation(api.boardPresence.heartbeat, { clientId: `client-${i}`, cursorX: 1, cursorY: 1 });
    }
    const list = await t.query(api.boardPresence.list, {});
    expect(list.length).toBeLessThanOrEqual(BOARD_MAX_PRESENCE_LIST);
  });
});
