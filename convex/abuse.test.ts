// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { STROKES_PER_CLIENT_WINDOW, RATE_LIMIT_WINDOW_MS, ADMIN_FAILED_VERIFY_WINDOW_MS } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

// abuse.ts's assertBoundedIdentifier/assertWritesEnabled/consumeRateLimit/
// tryConsumeRateLimit aren't exported as Convex functions, so they're
// exercised indirectly through strokes.submit (which chains all of them)
// rather than called directly.
describe("abuse — bounded identifiers and rate limiting, via strokes.submit", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  const baseArgs = {
    clientStrokeId: "s1",
    clientId: "client-a",
    mode: "draw" as const,
    color: "#000000",
    width: 4,
    points: [{ x: 1, y: 1 }],
    clientTimestamp: 0,
  };

  it("rejects an empty or over-length clientId (assertBoundedIdentifier)", async () => {
    await expect(
      t.mutation(api.strokes.submit, { ...baseArgs, clientId: "" }),
    ).rejects.toThrow(/clientId must contain/);
    await expect(
      t.mutation(api.strokes.submit, { ...baseArgs, clientId: "x".repeat(65) }),
    ).rejects.toThrow(/clientId must contain/);
  });

  it("blocks all writes when ALWAYSDRAW_READ_ONLY=1 (assertWritesEnabled)", async () => {
    vi.stubEnv("ALWAYSDRAW_READ_ONLY", "1");
    try {
      await expect(t.mutation(api.strokes.submit, baseArgs)).rejects.toThrow(/read-only/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("throws a ConvexError distinguishable from a plain validation error once a bucket is exhausted (consumeRateLimit)", async () => {
    for (let i = 0; i < STROKES_PER_CLIENT_WINDOW; i++) {
      await t.mutation(api.strokes.submit, { ...baseArgs, clientStrokeId: `s${i}` });
    }
    await expect(
      t.mutation(api.strokes.submit, { ...baseArgs, clientStrokeId: "over-limit" }),
    ).rejects.toThrow(/rate limit/);
  });

  it("resets a bucket once its window has elapsed", async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < STROKES_PER_CLIENT_WINDOW; i++) {
        await t.mutation(api.strokes.submit, { ...baseArgs, clientStrokeId: `w${i}` });
      }
      await expect(
        t.mutation(api.strokes.submit, { ...baseArgs, clientStrokeId: "still-blocked" }),
      ).rejects.toThrow(/rate limit/);

      vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1);

      await expect(
        t.mutation(api.strokes.submit, { ...baseArgs, clientStrokeId: "fresh-window" }),
      ).resolves.toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("abuse.clearExpiredRateLimits — cron cleanup", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("deletes only buckets older than the longest-lived window in use", async () => {
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimits", { key: "fresh", windowStartedAt: now, count: 1 });
      // Older than the short 10s window but well within the 60s admin
      // failed-guess window — must survive, or the 1-minute cron would
      // silently reset that stricter throttle mid-window.
      await ctx.db.insert("rateLimits", {
        key: "admin:verify:failed:global",
        windowStartedAt: now - (RATE_LIMIT_WINDOW_MS + 1000),
        count: 3,
      });
      // Older than even the longest window, times the cron's 2x cutoff
      // margin — must be deleted.
      await ctx.db.insert("rateLimits", {
        key: "ancient",
        windowStartedAt: now - 2 * ADMIN_FAILED_VERIFY_WINDOW_MS - 1000,
        count: 1,
      });
    });

    await t.mutation(internal.abuse.clearExpiredRateLimits, {});

    const remaining = await t.run(async (ctx) => ctx.db.query("rateLimits").collect());
    const keys = remaining.map((r) => r.key).sort();
    expect(keys).toEqual(["admin:verify:failed:global", "fresh"]);
  });
});
