// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { WORLD_WIDTH, MAX_REPORT_REASON_LENGTH, REPORTS_PER_CLIENT_WINDOW } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const PASSCODE = "test-admin-passcode";

describe("reports.create — area reports", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("creates a report for the current view (x/y/zoom)", async () => {
    const { id } = await t.mutation(api.reports.create, {
      reporterId: "reporter-a",
      targetType: "area",
      x: 100,
      y: 100,
      zoom: 1,
    });
    expect(id).toBeDefined();
  });

  it("creates a report for a drag-marked rectangle", async () => {
    const { id } = await t.mutation(api.reports.create, {
      reporterId: "reporter-a",
      targetType: "area",
      minX: 10,
      minY: 10,
      maxX: 20,
      maxY: 20,
    });
    expect(id).toBeDefined();
  });

  it("rejects an area report with neither a valid point nor rectangle", async () => {
    await expect(
      t.mutation(api.reports.create, { reporterId: "r", targetType: "area" }),
    ).rejects.toThrow(/needs x\/y within/);
  });

  it("rejects a rectangle where min >= max", async () => {
    await expect(
      t.mutation(api.reports.create, {
        reporterId: "r",
        targetType: "area",
        minX: 20,
        minY: 20,
        maxX: 10,
        maxY: 10,
      }),
    ).rejects.toThrow(/valid minX\/minY\/maxX\/maxY/);
  });

  it("rejects out-of-world coordinates", async () => {
    await expect(
      t.mutation(api.reports.create, {
        reporterId: "r",
        targetType: "area",
        x: WORLD_WIDTH + 1,
        y: 0,
      }),
    ).rejects.toThrow(/needs x\/y within/);
  });

  it("rejects zoom outside [0.1, 10]", async () => {
    await expect(
      t.mutation(api.reports.create, {
        reporterId: "r",
        targetType: "area",
        x: 0,
        y: 0,
        zoom: 0.05,
      }),
    ).rejects.toThrow(/zoom must be between/);
  });

  it("rejects a reason over the max length", async () => {
    await expect(
      t.mutation(api.reports.create, {
        reporterId: "r",
        targetType: "area",
        x: 0,
        y: 0,
        reason: "x".repeat(MAX_REPORT_REASON_LENGTH + 1),
      }),
    ).rejects.toThrow(/reason must not exceed/);
  });

  it("rejects a reason containing a blocked word", async () => {
    await expect(
      t.mutation(api.reports.create, {
        reporterId: "r",
        targetType: "area",
        x: 0,
        y: 0,
        reason: "this is fucking terrible",
      }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
  });

  it("rate limits excessive reports from a single reporter", async () => {
    for (let i = 0; i < REPORTS_PER_CLIENT_WINDOW; i++) {
      await t.mutation(api.reports.create, {
        reporterId: "report-spammer",
        targetType: "area",
        x: i,
        y: i,
      });
    }
    await expect(
      t.mutation(api.reports.create, {
        reporterId: "report-spammer",
        targetType: "area",
        x: 999,
        y: 999,
      }),
    ).rejects.toThrow(/rate limit/);
  });
});

describe("reports.create — comment reports", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("creates a report against an existing comment", async () => {
    const { id: commentId } = await t.mutation(api.comments.create, {
      clientId: "author",
      text: "flag me",
      x: 0,
      y: 0,
    });
    const { id } = await t.mutation(api.reports.create, {
      reporterId: "reporter",
      targetType: "comment",
      commentId,
    });
    expect(id).toBeDefined();
  });

  it("rejects a comment report missing commentId", async () => {
    await expect(
      t.mutation(api.reports.create, { reporterId: "r", targetType: "comment" }),
    ).rejects.toThrow(/needs commentId/);
  });

  it("rejects a comment report pointing at a nonexistent comment", async () => {
    const { id: commentId } = await t.mutation(api.comments.create, {
      clientId: "author",
      text: "will be deleted",
      x: 0,
      y: 0,
    });
    await t.mutation(api.comments.remove, { commentId, clientId: "author" });
    await expect(
      t.mutation(api.reports.create, { reporterId: "r", targetType: "comment", commentId }),
    ).rejects.toThrow(/no longer exists/);
  });
});

describe("reports.listOpen / updateStatus — moderation", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists open reports oldest-first for a valid passcode, empty for an invalid one", async () => {
    await t.mutation(api.reports.create, { reporterId: "r1", targetType: "area", x: 0, y: 0 });
    await t.mutation(api.reports.create, { reporterId: "r2", targetType: "area", x: 1, y: 1 });

    const open = await t.query(api.reports.listOpen, { passcode: PASSCODE });
    expect(open).toHaveLength(2);
    expect(open.every((r) => r.status === "open")).toBe(true);

    const denied = await t.query(api.reports.listOpen, { passcode: "wrong" });
    expect(denied).toEqual([]);
  });

  it("denormalizes comment text/author for a comment-target report", async () => {
    const { id: commentId } = await t.mutation(api.comments.create, {
      clientId: "author",
      username: "Alice",
      text: "flag this",
      x: 0,
      y: 0,
    });
    await t.mutation(api.reports.create, { reporterId: "r", targetType: "comment", commentId });

    const open = await t.query(api.reports.listOpen, { passcode: PASSCODE });
    expect(open).toHaveLength(1);
    expect(open[0].commentText).toBe("flag this");
    expect(open[0].commentAuthor).toBe("Alice");
  });

  it("updates a report's status given a valid passcode", async () => {
    const { id } = await t.mutation(api.reports.create, {
      reporterId: "r",
      targetType: "area",
      x: 0,
      y: 0,
    });
    const res = await t.mutation(api.reports.updateStatus, {
      passcode: PASSCODE,
      reportId: id,
      status: "dismissed",
    });
    expect(res.success).toBe(true);

    const open = await t.query(api.reports.listOpen, { passcode: PASSCODE });
    expect(open).toHaveLength(0);
  });

  it("reports rejection via return value (not a throw) for an invalid passcode, and leaves status unchanged", async () => {
    const { id } = await t.mutation(api.reports.create, {
      reporterId: "r",
      targetType: "area",
      x: 0,
      y: 0,
    });
    // See admin.ts's verifyAdminPasscode doc comment: a mutation gated by it
    // can't durably record a failed attempt if it also throws to reject the
    // request, since the throw rolls back everything in the same call.
    const res = await t.mutation(api.reports.updateStatus, {
      passcode: "wrong-passcode",
      reportId: id,
      status: "dismissed",
    });
    expect(res.success).toBe(false);
    expect(!res.success && res.error).toMatch(/INVALID_ADMIN_PASSCODE/);

    const open = await t.query(api.reports.listOpen, { passcode: PASSCODE });
    expect(open).toHaveLength(1);
  });
});
