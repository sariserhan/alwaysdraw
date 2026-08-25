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
      pageId: "geisha",
      username: "artist-a",
      cursorX: 100,
      cursorY: 100,
    });

    const geishaList = await t.query(api.sketchbookPresence.list, { pageId: "geisha" });
    const chessList = await t.query(api.sketchbookPresence.list, { pageId: "chess" });

    expect(geishaList.map((p) => p.clientId)).toEqual(["anon-a"]);
    expect(chessList).toHaveLength(0);
  });

  it("upserts by clientId — a second heartbeat updates position instead of adding a row", async () => {
    await t.mutation(api.sketchbookPresence.heartbeat, {
      clientId: "anon-b",
      pageId: "geisha",
      cursorX: 50,
      cursorY: 50,
    });
    await t.mutation(api.sketchbookPresence.heartbeat, {
      clientId: "anon-b",
      pageId: "geisha",
      cursorX: 100,
      cursorY: 100,
    });

    const rows = await t.query(api.sketchbookPresence.list, { pageId: "geisha" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ clientId: "anon-b", cursorX: 100, cursorY: 100 });
  });

  it("clamps cursor coordinates to the page's own bounds", async () => {
    await t.mutation(api.sketchbookPresence.heartbeat, {
      clientId: "anon-c",
      pageId: "geisha",
      cursorX: -50,
      cursorY: 999999,
    });
    const rows = await t.query(api.sketchbookPresence.list, { pageId: "geisha" });
    expect(rows[0].cursorX).toBe(0);
    expect(rows[0].cursorY).toBe(476.917); // geisha page height
  });
});
