// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const PASSCODE = "test-admin-passcode";

describe("boardComments", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates and lists a comment", async () => {
    await t.mutation(api.boardComments.create, {
      clientId: "a",
      text: "hello board",
      x: 100,
      y: 100,
    });
    const list = await t.query(api.boardComments.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe("hello board");
  });

  it("rejects a comment containing a blocked word", async () => {
    await expect(
      t.mutation(api.boardComments.create, { clientId: "a", text: "fuck this", x: 1, y: 1 }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
  });

  it("rejects coordinates outside board bounds", async () => {
    await expect(
      t.mutation(api.boardComments.create, { clientId: "a", text: "hi", x: 99999, y: 1 }),
    ).rejects.toThrow(/x must be within/);
  });

  it("only lets the comment's author delete it", async () => {
    const { id } = await t.mutation(api.boardComments.create, {
      clientId: "author",
      text: "mine",
      x: 1,
      y: 1,
    });
    await expect(
      t.mutation(api.boardComments.remove, { commentId: id, clientId: "someone-else" }),
    ).rejects.toThrow(/only delete your own/);
    await t.mutation(api.boardComments.remove, { commentId: id, clientId: "author" });
    expect(await t.query(api.boardComments.list, {})).toHaveLength(0);
  });

  it("adminRemove deletes any comment regardless of author, gated on the passcode", async () => {
    const { id } = await t.mutation(api.boardComments.create, {
      clientId: "author",
      text: "mine",
      x: 1,
      y: 1,
    });
    const wrongResult = await t.mutation(api.boardComments.adminRemove, {
      passcode: "wrong",
      commentId: id,
    });
    expect(wrongResult.success).toBe(false);
    expect(await t.query(api.boardComments.list, {})).toHaveLength(1);

    const result = await t.mutation(api.boardComments.adminRemove, { passcode: PASSCODE, commentId: id });
    expect(result.success).toBe(true);
    expect(await t.query(api.boardComments.list, {})).toHaveLength(0);
  });
});
