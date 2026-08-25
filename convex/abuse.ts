import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { RATE_LIMIT_WINDOW_MS, ADMIN_FAILED_VERIFY_WINDOW_MS } from "./constants";

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

// Non-throwing sibling of consumeRateLimit, for the rare call site that
// needs the "was this rejected" outcome to inform a value it returns
// normally instead of an exception.
//
// Why this exists: a Convex mutation's writes are ALL discarded together if
// the mutation's invocation ultimately throws — not just writes made after
// the throw, but every write made anywhere in that call, including ones
// made several calls deep through an awaited helper, through a nested
// ctx.runMutation (confirmed empirically: its writes vanish too if the
// *outer* mutation later throws, even though the nested call itself never
// threw), or through ctx.scheduler.runAfter/runAt (Convex's own docs: "if
// the mutation fails, no function will be scheduled, even if the function
// fails after the scheduling call"). See convex/src/server/database.ts's
// GenericDatabaseWriter docs ("all reads and writes within a single
// mutation are executed atomically") and convex/src/server/registration.ts
// ("Mutations run transactionally, all reads and writes within a single
// mutation are atomic and isolated").
//
// Consequence: "consume a rate-limit bucket, then throw to reject this
// request" can never make the consumption durable — the throw that rejects
// the request always undoes the very write meant to remember it happened.
// A caller that needs a rejected attempt to durably count against a budget
// (see admin.ts's verifyAdminPasscode) must call this instead of
// consumeRateLimit, and return `false`'s meaning as a normal value rather
// than translating it into a throw within the same mutation.
export async function tryConsumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (existing === null) {
    await ctx.db.insert("rateLimits", { key, windowStartedAt: now, count: 1 });
    return true;
  }

  if (now - existing.windowStartedAt >= windowMs) {
    await ctx.db.patch(existing._id, { windowStartedAt: now, count: 1 });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return true;
}

export async function consumeRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<void> {
  const ok = await tryConsumeRateLimit(ctx, key, limit, windowMs, now);
  if (!ok) {
    // ConvexError (not a plain Error) so the client can reliably tell "you got
    // rate limited" apart from other failures even in production, where plain
    // Error messages get redacted before reaching the client.
    //
    // Safe to throw here specifically: this branch never writes (the bucket
    // was already at its limit from a *previous*, already-committed call),
    // so there's nothing this throw could roll back and lose.
    throw new ConvexError("write rate limit exceeded — slow down and try again");
  }
}

// Client IDs are anonymous and spoofable, so expired buckets must not become
// an unbounded table. A bounded cron batch keeps cleanup within function limits.
export const clearExpiredRateLimits = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Must cover the longest-lived bucket in use, not just the common-case
    // RATE_LIMIT_WINDOW_MS (10s) — admin:verify:failed:global runs a 60s
    // window (ADMIN_FAILED_VERIFY_WINDOW_MS). Using only RATE_LIMIT_WINDOW_MS
    // here would let this 1-minute cron delete that bucket's row (cutoff
    // 20s old) while it's still actively enforcing its own 60s window,
    // silently resetting the strict admin throttle every ~20s.
    const cutoff = Date.now() - 2 * Math.max(RATE_LIMIT_WINDOW_MS, ADMIN_FAILED_VERIFY_WINDOW_MS);
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
