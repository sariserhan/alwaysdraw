import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { RATE_LIMIT_WINDOW_MS } from "./constants";

export function assertBoundedIdentifier(
  value: string,
  name: string,
  maxLength: number,
): void {
  if (value.length === 0 || value.length > maxLength) {
    throw new Error(`${name} must contain 1-${maxLength} characters`);
  }
}

export function assertWritesEnabled(): void {
  if (process.env.ALWAYSDRAW_READ_ONLY === "1") {
    throw new Error("the wall is temporarily read-only");
  }
}

export async function consumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<void> {
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (existing === null) {
    await ctx.db.insert("rateLimits", { key, windowStartedAt: now, count: 1 });
    return;
  }

  if (now - existing.windowStartedAt >= windowMs) {
    await ctx.db.patch(existing._id, { windowStartedAt: now, count: 1 });
    return;
  }

  if (existing.count >= limit) {
    // ConvexError (not a plain Error) so the client can reliably tell "you got
    // rate limited" apart from other failures even in production, where plain
    // Error messages get redacted before reaching the client.
    throw new ConvexError("write rate limit exceeded — slow down and try again");
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}

// Client IDs are anonymous and spoofable, so expired buckets must not become
// an unbounded table. A bounded cron batch keeps cleanup within function limits.
export const clearExpiredRateLimits = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cutoff = Date.now() - 2 * RATE_LIMIT_WINDOW_MS;
    const expired = await ctx.db
      .query("rateLimits")
      .withIndex("by_windowStartedAt", (q) => q.lt("windowStartedAt", cutoff))
      .take(1000);
    for (const bucket of expired) {
      await ctx.db.delete(bucket._id);
    }
    return null;
  },
});
