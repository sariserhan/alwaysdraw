// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { claimNextSequence } from "./boardMetadata";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("boardMetadata.claimNextSequence", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("starts at 1 and increments on each call, creating the row on first use", async () => {
    const first = await t.run((ctx) => claimNextSequence(ctx));
    expect(first).toBe(1);
    const second = await t.run((ctx) => claimNextSequence(ctx));
    expect(second).toBe(2);

    const rows = await t.run((ctx) => ctx.db.query("boardMetadata").take(2));
    expect(rows).toHaveLength(1);
    expect(rows[0].currentSequence).toBe(2);
  });
});
