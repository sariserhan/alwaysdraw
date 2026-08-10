// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("snapshots query and mutation", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns null when no snapshots exist", async () => {
    const latest = await t.query(api.snapshots.getLatest, {});
    expect(latest).toBeNull();
  });

  it("submits and retrieves the latest snapshot sorted by sequence", async () => {
    await t.mutation(api.snapshots.submit, {
      sequence: 100,
      imageData: "data:image/webp;base64,sample100",
      strokeCount: 50,
    });
    await t.mutation(api.snapshots.submit, {
      sequence: 500,
      imageData: "data:image/webp;base64,sample500",
      strokeCount: 250,
    });
    await t.mutation(api.snapshots.submit, {
      sequence: 300,
      imageData: "data:image/webp;base64,sample300",
      strokeCount: 150,
    });

    const latest = await t.query(api.snapshots.getLatest, {});
    expect(latest).not.toBeNull();
    expect(latest?.sequence).toBe(500);
    expect(latest?.strokeCount).toBe(250);
    expect(latest?.imageData).toBe("data:image/webp;base64,sample500");
  });

  it("prevents duplicate snapshots for the exact same sequence", async () => {
    const id1 = await t.mutation(api.snapshots.submit, {
      sequence: 1000,
      imageData: "data:image/webp;base64,sample1000a",
      strokeCount: 500,
    });
    const id2 = await t.mutation(api.snapshots.submit, {
      sequence: 1000,
      imageData: "data:image/webp;base64,sample1000b",
      strokeCount: 500,
    });

    expect(id1).toBe(id2);
  });

  it("rejects malformed imageData that isn't a base64 image data URL", async () => {
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 1,
        imageData: "not-a-data-url",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/imageData/);
  });

  it("rejects an oversized imageData payload", async () => {
    const huge = "data:image/webp;base64," + "A".repeat(6 * 1024 * 1024);
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 1,
        imageData: huge,
        strokeCount: 1,
      }),
    ).rejects.toThrow(/size limit/);
  });

  it("rejects a negative sequence or strokeCount", async () => {
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: -1,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/sequence/);
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 1,
        imageData: "data:image/webp;base64,sample",
        strokeCount: -1,
      }),
    ).rejects.toThrow(/strokeCount/);
  });

  it("rate limits excessive global submissions", async () => {
    for (let i = 0; i < 5; i++) {
      await t.mutation(api.snapshots.submit, {
        sequence: i,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      });
    }
    await expect(
      t.mutation(api.snapshots.submit, {
        sequence: 999,
        imageData: "data:image/webp;base64,sample",
        strokeCount: 1,
      }),
    ).rejects.toThrow(/rate limit/);
  });
});
