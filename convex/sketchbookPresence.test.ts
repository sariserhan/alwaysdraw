// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("sketchbookPresence.heartbeat / list", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("rejects an unknown pageId", async () => {
    await expect(
      t.mutation(api.sketchbookPresence.heartbeat, {
        clientId: "anon-a",
        pageId: "not-a-page",
        cursorX: 10,
        cursorY: 10,
      }),
    ).rejects.toThrow();
  });

  it("appears in list for the page it heartbeat on, not other pages", async () => {
    await t.mutation(api.sketchbookPresence.heartbeat, {
      clientId: "anon-a",
      pageId: "flower",
      username: "artist-a",
      cursorX: 400,
      cursorY: 400,
    });

    const flowerList = await t.query(api.sketchbookPresence.list, { pageId: "flower" });
    const circleList = await t.query(api.sketchbookPresence.list, { pageId: "circle" });

    expect(flowerList.map((p) => p.clientId)).toEqual(["anon-a"]);
    expect(circleList).toHaveLength(0);
  });

  it("upserts by clientId — a second heartbeat updates position instead of adding a row", async () => {
    await t.mutation(api.sketchbookPresence.heartbeat, {
      clientId: "anon-b",
      pageId: "flower",
      cursorX: 100,
      cursorY: 100,
    });
    await t.mutation(api.sketchbookPresence.heartbeat, {
      clientId: "anon-b",
      pageId: "flower",
      cursorX: 200,
      cursorY: 200,
    });

    const rows = await t.query(api.sketchbookPresence.list, { pageId: "flower" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clientId: "anon-b", cursorX: 200, cursorY: 200 });
  });

  it("clamps cursor coordinates to the page's own bounds", async () => {
    await t.mutation(api.sketchbookPresence.heartbeat, {
      clientId: "anon-c",
      pageId: "circle",
      cursorX: -50,
      cursorY: 999999,
    });
    const rows = await t.query(api.sketchbookPresence.list, { pageId: "circle" });
    expect(rows[0].cursorX).toBe(0);
    expect(rows[0].cursorY).toBe(400); // circle page height
  });
});
