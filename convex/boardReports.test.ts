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

describe("boardReports", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates an area report with a point, and it shows up in the open queue", async () => {
    await t.mutation(api.boardReports.create, {
      reporterId: "reporter-1",
      targetType: "area",
      x: 100,
      y: 100,
    });
    const open = await t.query(api.boardReports.listOpen, { passcode: PASSCODE });
    expect(open).toHaveLength(1);
    expect(open[0].status).toBe("open");
  });

  it("creates an area report with a marked rectangle", async () => {
    await t.mutation(api.boardReports.create, {
      reporterId: "reporter-1",
      targetType: "area",
      minX: 10,
      minY: 10,
      maxX: 50,
      maxY: 50,
    });
    const open = await t.query(api.boardReports.listOpen, { passcode: PASSCODE });
    expect(open[0].minX).toBe(10);
    expect(open[0].maxY).toBe(50);
  });

  it("rejects an area report with an inverted rectangle", async () => {
    await expect(
      t.mutation(api.boardReports.create, {
        reporterId: "r",
        targetType: "area",
        minX: 50,
        minY: 50,
        maxX: 10,
        maxY: 10,
      }),
    ).rejects.toThrow(/rectangle/);
  });

  it("denormalizes comment text/author for a comment report", async () => {
    const { id } = await t.mutation(api.boardComments.create, {
      clientId: "author",
      username: "PixelArtist",
      text: "hello",
      x: 1,
      y: 1,
    });
    await t.mutation(api.boardReports.create, {
      reporterId: "reporter-1",
      targetType: "comment",
      commentId: id,
    });
    const open = await t.query(api.boardReports.listOpen, { passcode: PASSCODE });
    expect(open[0].commentText).toBe("hello");
    expect(open[0].commentAuthor).toBe("PixelArtist");
  });

  it("updateStatus requires a valid passcode", async () => {
    await t.mutation(api.boardReports.create, { reporterId: "r", targetType: "area", x: 1, y: 1 });
    const [report] = await t.query(api.boardReports.listOpen, { passcode: PASSCODE });
    const wrong = await t.mutation(api.boardReports.updateStatus, {
      passcode: "wrong",
      reportId: report._id,
      status: "dismissed",
    });
    expect(wrong.success).toBe(false);
    const result = await t.mutation(api.boardReports.updateStatus, {
      passcode: PASSCODE,
      reportId: report._id,
      status: "dismissed",
    });
    expect(result.success).toBe(true);
    expect(await t.query(api.boardReports.listOpen, { passcode: PASSCODE })).toHaveLength(0);
  });
});
