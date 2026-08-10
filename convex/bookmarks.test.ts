// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("bookmarks (convex/bookmarks.ts)", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("creates and lists bookmarks successfully", async () => {
    const res = await t.mutation(api.bookmarks.create, {
      title: "Mona Lisa Mural",
      x: 4500,
      y: 3200,
      zoom: 2.5,
      clientId: "anon-tester",
    });
    expect(res.id).toBeDefined();

    const list = await t.query(api.bookmarks.list, { limit: 10 });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Mona Lisa Mural");
    expect(list[0].x).toBe(4500);
    expect(list[0].y).toBe(3200);
  });

  it("rejects invalid titles and out-of-bound coordinates", async () => {
    await expect(
      t.mutation(api.bookmarks.create, {
        title: "",
        x: 100,
        y: 100,
        zoom: 1,
        clientId: "anon-tester",
      }),
    ).rejects.toThrow();

    await expect(
      t.mutation(api.bookmarks.create, {
        title: "Too Far",
        x: 99999,
        y: 100,
        zoom: 1,
        clientId: "anon-tester",
      }),
    ).rejects.toThrow();
  });
});
