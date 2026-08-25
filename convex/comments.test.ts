// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_COMMENT_LENGTH, COMMENTS_PER_CLIENT_WINDOW, RATE_LIMIT_WINDOW_MS } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const PASSCODE = "test-admin-passcode";

describe("comments.create / list", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("creates a comment and lists it back, newest first", async () => {
    await t.mutation(api.comments.create, {
      clientId: "client-a",
      username: "Alice",
      text: "first",
      x: 100,
      y: 100,
    });
    await t.mutation(api.comments.create, {
      clientId: "client-b",
      text: "second",
      x: 200,
      y: 200,
    });

    const list = await t.query(api.comments.list, {});
    expect(list).toHaveLength(2);
    expect(list[0].text).toBe("second");
    expect(list[1].text).toBe("first");
  });

  it("rejects an empty or over-length comment", async () => {
    await expect(
      t.mutation(api.comments.create, { clientId: "c", text: "   ", x: 0, y: 0 }),
    ).rejects.toThrow(/comment must be between/);
    await expect(
      t.mutation(api.comments.create, {
        clientId: "c",
        text: "x".repeat(MAX_COMMENT_LENGTH + 1),
        x: 0,
        y: 0,
      }),
    ).rejects.toThrow(/comment must be between/);
  });

  it("rejects a comment or username containing a blocked word", async () => {
    await expect(
      t.mutation(api.comments.create, { clientId: "c", text: "fuck this", x: 0, y: 0 }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
    await expect(
      t.mutation(api.comments.create, {
        clientId: "c",
        username: "fuck",
        text: "hello",
        x: 0,
        y: 0,
      }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
  });

  it("rejects out-of-world coordinates", async () => {
    await expect(
      t.mutation(api.comments.create, { clientId: "c", text: "hi", x: -1, y: 0 }),
    ).rejects.toThrow(/x must be within/);
    await expect(
      t.mutation(api.comments.create, { clientId: "c", text: "hi", x: 0, y: 999_999 }),
    ).rejects.toThrow(/y must be within/);
  });

  it("rate limits excessive comments from a single client", async () => {
    for (let i = 0; i < COMMENTS_PER_CLIENT_WINDOW; i++) {
      await t.mutation(api.comments.create, {
        clientId: "spammer",
        text: `comment ${i}`,
        x: 0,
        y: 0,
      });
    }
    await expect(
      t.mutation(api.comments.create, { clientId: "spammer", text: "one more", x: 0, y: 0 }),
    ).rejects.toThrow(/rate limit/);
  });
});

describe("comments.remove — self-service", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("lets the author delete their own comment", async () => {
    const { id } = await t.mutation(api.comments.create, {
      clientId: "author",
      text: "delete me",
      x: 0,
      y: 0,
    });
    await t.mutation(api.comments.remove, { commentId: id, clientId: "author" });
    const list = await t.query(api.comments.list, {});
    expect(list).toHaveLength(0);
  });

  it("refuses to delete a comment belonging to a different clientId", async () => {
    const { id } = await t.mutation(api.comments.create, {
      clientId: "author",
      text: "not yours",
      x: 0,
      y: 0,
    });
    await expect(
      t.mutation(api.comments.remove, { commentId: id, clientId: "someone-else" }),
    ).rejects.toThrow(/can only delete your own/);
    const list = await t.query(api.comments.list, {});
    expect(list).toHaveLength(1);
  });

  it("rate limits excessive delete attempts from a single client", async () => {
    // create and remove are separate buckets (canvasComments:client:X vs
    // canvasComments:remove:client:X), but creating COMMENTS_PER_CLIENT_WINDOW+1
    // comments up front would itself trip the CREATE bucket — advance fake
    // time past RATE_LIMIT_WINDOW_MS between creates so only the later,
    // real-time-clustered remove calls exercise the remove bucket's own cap.
    vi.useFakeTimers();
    const ids: Id<"canvasComments">[] = [];
    try {
      for (let i = 0; i < COMMENTS_PER_CLIENT_WINDOW + 1; i++) {
        const { id } = await t.mutation(api.comments.create, {
          clientId: "delete-spammer",
          text: `comment ${i}`,
          x: 0,
          y: 0,
        });
        ids.push(id);
        vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1000);
      }
    } finally {
      vi.useRealTimers();
    }

    for (let i = 0; i < COMMENTS_PER_CLIENT_WINDOW; i++) {
      await t.mutation(api.comments.remove, { commentId: ids[i], clientId: "delete-spammer" });
    }
    await expect(
      t.mutation(api.comments.remove, {
        commentId: ids[COMMENTS_PER_CLIENT_WINDOW],
        clientId: "delete-spammer",
      }),
    ).rejects.toThrow(/rate limit/);
  });
});

describe("comments.adminRemove — moderation", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("deletes any comment regardless of author, given a valid passcode", async () => {
    const { id } = await t.mutation(api.comments.create, {
      clientId: "some-random-author",
      text: "not the admin's comment",
      x: 0,
      y: 0,
    });
    await t.mutation(api.comments.adminRemove, { passcode: PASSCODE, commentId: id });
    const list = await t.query(api.comments.list, {});
    expect(list).toHaveLength(0);
  });

  it("rejects an invalid passcode and leaves the comment in place", async () => {
    const { id } = await t.mutation(api.comments.create, {
      clientId: "author",
      text: "still here",
      x: 0,
      y: 0,
    });
    // adminRemove reports rejection via its return value, not a thrown
    // error — a mutation gated by verifyAdminPasscode can't durably record a
    // failed passcode attempt if it also throws to reject the request; the
    // throw would roll back that very record along with everything else in
    // the same call. See admin.ts's verifyAdminPasscode doc comment.
    const res = await t.mutation(api.comments.adminRemove, { passcode: "wrong-passcode", commentId: id });
    expect(res.success).toBe(false);
    expect(!res.success && res.error).toMatch(/INVALID_ADMIN_PASSCODE/);
    const list = await t.query(api.comments.list, {});
    expect(list).toHaveLength(1);
  });
});
