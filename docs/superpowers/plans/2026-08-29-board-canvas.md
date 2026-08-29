# Board Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, independent shared canvas ("Board") that is fixed-size, always fully visible, and never zooms or pans — with the same full drawing toolset and moderation parity as the main wall.

**Architecture:** New Convex tables/modules (`boardStrokes`, `boardPresence`, `boardComments`, `boardReports`, `boardMetadata`, `boardAdmin`) mirror the main wall's shape field-for-field, minus tiling and the snapshot-image optimization. `components/GlobalCanvas.tsx` gains a `mode` prop resolved once to a `CanvasBackend` object (`lib/canvasBackend.ts`) so every existing Convex call site and every line of drawing/rendering logic is reused unchanged — only camera handling branches on `backend.supportsZoomPan`.

**Tech Stack:** Next.js (App Router), Convex, TypeScript, Vitest (`convex-test`), Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-board-canvas-design.md`

## Global Constraints

- Board's fixed world size is exactly `2400 × 1350` (`BOARD_WIDTH`/`BOARD_HEIGHT`).
- Every new Convex table/function mirrors its main-wall counterpart's validation and error conventions exactly: `ConvexError` (never a plain `Error`) for anything the client must distinguish from a generic failure, plain `Error` only for validation the client doesn't need to branch on — matching `strokes.ts`/`presence.ts`/`comments.ts`/`reports.ts`'s existing convention.
- No tiling, no snapshot-image optimization, no `protectedZones` concept for Board — see the spec's Non-goals.
- `boardAdmin.pruneDeletedStrokes` is **off by default** (`boardMetadata.autoPruneEnabled` unset/false) — the primary regression test for that feature is that nothing gets pruned until an admin explicitly enables it.
- Every admin-gated mutation uses the existing shared `verifyAdminPasscode` from `convex/admin.ts` — no new admin/auth concept.
- Rate-limit constants are separately namespaced with a `BOARD_` prefix, same numeric values as their main-wall counterparts, following the existing `SKETCHBOOK_*` naming precedent.

---

### Task 1: Schema, constants, and `boardMetadata.ts`

**Files:**
- Modify: `convex/schema.ts` (add `boardStrokes`, `boardMetadata`, `boardPresence`, `boardComments`, `boardReports` tables)
- Modify: `convex/constants.ts` (add `BOARD_*` constants)
- Create: `convex/boardMetadata.ts`
- Test: `convex/boardMetadata.test.ts`

**Interfaces:**
- Produces: `claimNextSequence(ctx: MutationCtx): Promise<number>` — exported from `convex/boardMetadata.ts`, used by Tasks 2 and 6.
- Produces: schema tables `boardStrokes`, `boardMetadata` (fields: `currentSequence: number`, `autoPruneEnabled?: boolean`), `boardPresence`, `boardComments`, `boardReports` — used by Tasks 2-7.
- Produces: constants `BOARD_WIDTH`, `BOARD_HEIGHT`, `BOARD_STROKES_PER_CLIENT_WINDOW`, `BOARD_STROKES_GLOBAL_WINDOW`, `BOARD_HEARTBEATS_PER_CLIENT_WINDOW`, `BOARD_HEARTBEATS_GLOBAL_WINDOW`, `BOARD_COMMENTS_PER_CLIENT_WINDOW`, `BOARD_COMMENTS_GLOBAL_WINDOW`, `BOARD_REPORTS_PER_CLIENT_WINDOW`, `BOARD_REPORTS_GLOBAL_WINDOW`, `BOARD_WIPE_BATCH_SIZE`, `BOARD_MAX_PRESENCE_LIST`, `BOARD_DELETED_STROKE_RETENTION_MS`, `BOARD_PRUNE_BATCH_SIZE` — used by Tasks 2-7.

- [ ] **Step 1: Add the new tables to the schema**

In `convex/schema.ts`, add these five table definitions (place them after the existing `strokes`/`canvasMetadata`/`presence`/`canvasComments`/`contentReports` block, before `broadcasts`):

```ts
  boardStrokes: defineTable({
    clientStrokeId: v.string(),
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    brushType: v.optional(brushTypeValidator),
    color: v.string(),
    width: v.number(),
    opacity: v.optional(v.number()),
    points: v.array(v.object({ x: v.number(), y: v.number() })),
    clientTimestamp: v.number(),
    sequence: v.number(),
    serverTimestamp: v.number(),
    deleted: v.optional(v.boolean()),
  })
    .index("by_sequence", ["sequence"])
    .index("by_clientStrokeId", ["clientStrokeId"])
    .index("by_clientId", ["clientId"]),

  boardMetadata: defineTable({
    currentSequence: v.number(),
    autoPruneEnabled: v.optional(v.boolean()),
  }),

  boardPresence: defineTable({
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    lastSeenAt: v.number(),
    cursorX: v.number(),
    cursorY: v.number(),
    laserTrail: v.optional(
      v.array(v.object({ x: v.number(), y: v.number(), timestamp: v.number() })),
    ),
  })
    .index("by_clientId", ["clientId"])
    .index("by_lastSeenAt", ["lastSeenAt"]),

  boardComments: defineTable({
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    text: v.string(),
    x: v.number(),
    y: v.number(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  boardReports: defineTable({
    reporterId: v.string(),
    targetType: v.union(v.literal("area"), v.literal("comment")),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    minX: v.optional(v.number()),
    minY: v.optional(v.number()),
    maxX: v.optional(v.number()),
    maxY: v.optional(v.number()),
    commentId: v.optional(v.id("boardComments")),
    reason: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed")),
    createdAt: v.number(),
  })
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_reporter", ["reporterId"]),
```

- [ ] **Step 2: Run typecheck to confirm the schema compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Add the new constants**

In `convex/constants.ts`, add after the existing `SNAPSHOTS_PRUNE_BATCH_SIZE` block (near the other feature-scoped constants):

```ts
// Board: a fixed-size, non-zoomable, always-fully-visible second shared
// canvas — see docs/superpowers/specs/2026-08-29-board-canvas-design.md.
export const BOARD_WIDTH = 2400;
export const BOARD_HEIGHT = 1350;
export const BOARD_STROKES_PER_CLIENT_WINDOW = 300;
export const BOARD_STROKES_GLOBAL_WINDOW = 2_000;
export const BOARD_HEARTBEATS_PER_CLIENT_WINDOW = 80;
export const BOARD_HEARTBEATS_GLOBAL_WINDOW = 4_000;
export const BOARD_COMMENTS_PER_CLIENT_WINDOW = 10;
export const BOARD_COMMENTS_GLOBAL_WINDOW = 200;
export const BOARD_REPORTS_PER_CLIENT_WINDOW = 5;
export const BOARD_REPORTS_GLOBAL_WINDOW = 50;
export const BOARD_WIPE_BATCH_SIZE = 500;
// Presence list is bounded the same way presence.list already is — a
// public, anonymous, zero-signup page must never assume its own realistic
// traffic; it must be bounded regardless of how many people show up.
export const BOARD_MAX_PRESENCE_LIST = 50;
// Soft-deleted boardStrokes rows are hard-deleted after this long by
// boardAdmin.pruneDeletedStrokes, IF an admin has opted in (see
// boardMetadata.autoPruneEnabled) — off by default.
export const BOARD_DELETED_STROKE_RETENTION_MS = 24 * 60 * 60 * 1000;
export const BOARD_PRUNE_BATCH_SIZE = 500;
```

- [ ] **Step 4: Write the failing test for `claimNextSequence`**

Create `convex/boardMetadata.test.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run convex/boardMetadata.test.ts`
Expected: FAIL with a module-not-found error for `./boardMetadata` (the file doesn't exist yet)

- [ ] **Step 6: Implement `convex/boardMetadata.ts`**

```ts
import type { MutationCtx } from "./_generated/server";

/** Claims the next Board stroke sequence number — same
 * transactional read-increment-write pattern as canvasMetadata's version
 * for the main wall, on Board's own separate singleton row. Shared by
 * boardStrokes.submit (a new stroke) and boardAdmin's soft-deletes (a
 * tombstone patch) — both need a real, unique, monotonically-increasing
 * sequence so clients' incremental sync picks them up as a new event. */
export async function claimNextSequence(ctx: MutationCtx): Promise<number> {
  let metadata = await ctx.db.query("boardMetadata").first();
  if (metadata === null) {
    const id = await ctx.db.insert("boardMetadata", { currentSequence: 0 });
    metadata = await ctx.db.get(id);
    if (metadata === null) throw new Error("failed to create boardMetadata");
  }
  const next = metadata.currentSequence + 1;
  await ctx.db.patch(metadata._id, { currentSequence: next });
  return next;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run convex/boardMetadata.test.ts`
Expected: PASS (1 test)

- [ ] **Step 8: Commit**

```bash
git add convex/schema.ts convex/constants.ts convex/boardMetadata.ts convex/boardMetadata.test.ts
git commit -m "Add Board schema, constants, and sequence counter"
```

---

### Task 2: `boardStrokes.ts`

**Files:**
- Create: `convex/boardStrokes.ts`
- Test: `convex/boardStrokes.test.ts`

**Interfaces:**
- Consumes: `claimNextSequence` from `convex/boardMetadata.ts` (Task 1); `assertBoundedIdentifier`, `assertWritesEnabled`, `consumeRateLimit` from `convex/abuse.ts`; `containsProfanity` from `convex/profanity.ts`; `BOARD_WIDTH`, `BOARD_HEIGHT`, `BOARD_STROKES_PER_CLIENT_WINDOW`, `BOARD_STROKES_GLOBAL_WINDOW` from `convex/constants.ts` (Task 1), plus the shared (non-`BOARD_`) constants `MIN_BRUSH_WIDTH`, `MAX_BRUSH_WIDTH`, `MIN_OPACITY`, `MAX_OPACITY`, `MIN_POINTS_PER_STROKE`, `MAX_POINTS_PER_STROKE`, `DEFAULT_LIST_LIMIT`, `MAX_LIST_LIMIT`, `COLOR_PATTERN`, `BRUSH_TYPES`, `MAX_CLIENT_ID_LENGTH`, `MAX_CLIENT_STROKE_ID_LENGTH`, `MAX_COLOR_LENGTH`, `MAX_USERNAME_LENGTH`, `COUNTRY_CODE_PATTERN`, `RATE_LIMIT_WINDOW_MS`.
- Produces: `submit` mutation, `listSince` query — used by Task 8 (`CanvasBackend`) and Task 6 (`boardAdmin.wipeAll`, which needs the `boardStrokes` table/index directly, not these functions).

Note: unlike `strokes.ts`, there is no `getLatest` (that name belongs to the main wall's *snapshot* optimization, which Board explicitly skips — see spec Non-goals) and no `listByTiles`/`tiles` field (no tiling) and no `adminPasscode`/protected-zone check (Board has no protected-zones concept — that feature is scoped to the main wall's own coordinate space).

- [ ] **Step 1: Write the failing tests**

Create `convex/boardStrokes.test.ts`:

```ts
// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { BrushType } from "../lib/types";
import { BOARD_STROKES_GLOBAL_WINDOW } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseArgs = {
  clientStrokeId: "stroke-1",
  clientId: "anon-tester",
  mode: "draw" as const,
  brushType: "brush" as BrushType,
  color: "#e0432b",
  width: 8,
  opacity: 1,
  points: [{ x: 10, y: 10 }],
  clientTimestamp: 0,
};

describe("boardStrokes.submit", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("accepts a valid stroke and returns an increasing sequence", async () => {
    const first = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "a" });
    const second = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "b" });
    expect(second.sequence).toBeGreaterThan(first.sequence);
  });

  it("is idempotent on clientStrokeId", async () => {
    const first = await t.mutation(api.boardStrokes.submit, baseArgs);
    const second = await t.mutation(api.boardStrokes.submit, baseArgs);
    expect(second.sequence).toBe(first.sequence);
  });

  it("rejects a point outside the fixed board bounds", async () => {
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, points: [{ x: 99999, y: 10 }] }),
    ).rejects.toThrow(/board bounds|BOARD_WIDTH|within/i);
  });

  it("rejects an invalid color", async () => {
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, color: "not-a-color" }),
    ).rejects.toThrow(/color/);
  });

  it("rejects a username containing a blocked word", async () => {
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, username: "fuck" }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
  });

  it("rate limits excessive global submissions", async () => {
    for (let i = 0; i < BOARD_STROKES_GLOBAL_WINDOW; i++) {
      await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: `flood-${i}` });
    }
    await expect(
      t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "flood-over" }),
    ).rejects.toThrow(/rate limit/i);
  });
});

describe("boardStrokes.listSince", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns only strokes after the given sequence, in ascending order", async () => {
    const a = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "a" });
    const b = await t.mutation(api.boardStrokes.submit, { ...baseArgs, clientStrokeId: "b" });
    const rows = await t.query(api.boardStrokes.listSince, { afterSequence: a.sequence });
    expect(rows).toHaveLength(1);
    expect(rows[0].sequence).toBe(b.sequence);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/boardStrokes.test.ts`
Expected: FAIL with a module-not-found error for `./boardStrokes`

- [ ] **Step 3: Implement `convex/boardStrokes.ts`**

```ts
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BOARD_STROKES_PER_CLIENT_WINDOW,
  BOARD_STROKES_GLOBAL_WINDOW,
  MIN_BRUSH_WIDTH,
  MAX_BRUSH_WIDTH,
  MIN_OPACITY,
  MAX_OPACITY,
  MIN_POINTS_PER_STROKE,
  MAX_POINTS_PER_STROKE,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  COLOR_PATTERN,
  BRUSH_TYPES,
  MAX_CLIENT_ID_LENGTH,
  MAX_CLIENT_STROKE_ID_LENGTH,
  MAX_COLOR_LENGTH,
  MAX_USERNAME_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
} from "./constants";
import {
  assertBoundedIdentifier,
  assertWritesEnabled,
  consumeRateLimit,
} from "./abuse";
import { containsProfanity } from "./profanity";
import { claimNextSequence } from "./boardMetadata";

const pointValidator = v.object({ x: v.number(), y: v.number() });
const brushTypeValidator = v.union(...BRUSH_TYPES.map((t) => v.literal(t)));

const boardStrokeReturnFields = v.object({
  _id: v.id("boardStrokes"),
  _creationTime: v.number(),
  clientStrokeId: v.string(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  mode: v.union(v.literal("draw"), v.literal("erase")),
  brushType: v.optional(brushTypeValidator),
  color: v.string(),
  width: v.number(),
  opacity: v.optional(v.number()),
  points: v.array(pointValidator),
  clientTimestamp: v.number(),
  sequence: v.number(),
  serverTimestamp: v.number(),
  deleted: v.optional(v.boolean()),
});

export const submit = mutation({
  args: {
    clientStrokeId: v.string(),
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    brushType: v.optional(brushTypeValidator),
    color: v.string(),
    width: v.number(),
    opacity: v.optional(v.number()),
    points: v.array(pointValidator),
    clientTimestamp: v.number(),
  },
  returns: v.object({ sequence: v.number() }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    assertBoundedIdentifier(args.clientStrokeId, "clientStrokeId", MAX_CLIENT_STROKE_ID_LENGTH);
    if (args.color.length > MAX_COLOR_LENGTH) {
      throw new Error(`color must not exceed ${MAX_COLOR_LENGTH} characters`);
    }
    if (!Number.isFinite(args.clientTimestamp)) {
      throw new Error("clientTimestamp must be a finite number");
    }
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
      if (containsProfanity(args.username)) {
        throw new ConvexError("PROFANITY_BLOCKED: username contains a blocked word — please choose another");
      }
    }
    if (args.countryCode !== undefined && !COUNTRY_CODE_PATTERN.test(args.countryCode)) {
      throw new Error("countryCode must be a 2-letter ISO 3166-1 alpha-2 code");
    }
    if (!Number.isFinite(args.width) || args.width < MIN_BRUSH_WIDTH || args.width > MAX_BRUSH_WIDTH) {
      throw new Error(`width must be in [${MIN_BRUSH_WIDTH}, ${MAX_BRUSH_WIDTH}]`);
    }
    if (args.points.length < MIN_POINTS_PER_STROKE || args.points.length > MAX_POINTS_PER_STROKE) {
      throw new Error(`points.length must be in [${MIN_POINTS_PER_STROKE}, ${MAX_POINTS_PER_STROKE}]`);
    }
    for (const p of args.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        throw new Error("point coordinates must be finite numbers");
      }
      if (p.x < 0 || p.x > BOARD_WIDTH || p.y < 0 || p.y > BOARD_HEIGHT) {
        throw new Error(`point coordinates must be within board bounds [0, ${BOARD_WIDTH}] x [0, ${BOARD_HEIGHT}]`);
      }
    }
    if (!COLOR_PATTERN.test(args.color)) {
      throw new Error("color must be a hex or rgb()/rgba() string");
    }
    if (
      args.opacity !== undefined &&
      (!Number.isFinite(args.opacity) || args.opacity < MIN_OPACITY || args.opacity > MAX_OPACITY)
    ) {
      throw new Error(`opacity must be in [${MIN_OPACITY}, ${MAX_OPACITY}]`);
    }

    const existing = await ctx.db
      .query("boardStrokes")
      .withIndex("by_clientStrokeId", (q) => q.eq("clientStrokeId", args.clientStrokeId))
      .unique();
    if (existing !== null) {
      return { sequence: existing.sequence };
    }

    await consumeRateLimit(
      ctx,
      `boardStrokes:client:${args.clientId}`,
      BOARD_STROKES_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "boardStrokes:global", BOARD_STROKES_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const nextSequence = await claimNextSequence(ctx);

    await ctx.db.insert("boardStrokes", {
      clientStrokeId: args.clientStrokeId,
      clientId: args.clientId,
      username: args.username,
      countryCode: args.countryCode,
      mode: args.mode,
      brushType: args.mode === "draw" ? (args.brushType ?? "brush") : undefined,
      color: args.color,
      width: args.width,
      opacity: args.opacity ?? 1,
      points: args.points,
      clientTimestamp: args.clientTimestamp,
      sequence: nextSequence,
      serverTimestamp: Date.now(),
    });

    return { sequence: nextSequence };
  },
});

export const listSince = query({
  args: {
    afterSequence: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(boardStrokeReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT);
    return await ctx.db
      .query("boardStrokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", args.afterSequence))
      .order("asc")
      .take(limit);
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run convex/boardStrokes.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/boardStrokes.ts convex/boardStrokes.test.ts
git commit -m "Add boardStrokes: submit and listSince"
```

---

### Task 3: `boardPresence.ts`

**Files:**
- Create: `convex/boardPresence.ts`
- Test: `convex/boardPresence.test.ts`

**Interfaces:**
- Consumes: `assertBoundedIdentifier`, `assertWritesEnabled`, `consumeRateLimit` from `convex/abuse.ts`; `containsProfanity` from `convex/profanity.ts`; `BOARD_WIDTH`, `BOARD_HEIGHT`, `BOARD_HEARTBEATS_PER_CLIENT_WINDOW`, `BOARD_HEARTBEATS_GLOBAL_WINDOW`, `BOARD_MAX_PRESENCE_LIST` from `convex/constants.ts` (Task 1), plus shared constants `PRESENCE_ONLINE_WINDOW_MS`, `MAX_LASER_TRAIL_POINTS`, `MAX_CLIENT_ID_LENGTH`, `MAX_USERNAME_LENGTH`, `RATE_LIMIT_WINDOW_MS`, `COUNTRY_CODE_PATTERN`.
- Produces: `heartbeat` mutation, `list` query — used by Task 8 (`CanvasBackend`).

Note: no `listByTiles`/`tileKey` (no tiling), no `onlineCount` (spec explicitly defers this — `list` itself is already bounded).

- [ ] **Step 1: Write the failing tests**

Create `convex/boardPresence.test.ts`:

```ts
// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { BOARD_MAX_PRESENCE_LIST } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

describe("boardPresence.heartbeat", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("accepts a valid heartbeat and countryCode is listed back", async () => {
    await t.mutation(api.boardPresence.heartbeat, {
      clientId: "a",
      countryCode: "JP",
      cursorX: 10,
      cursorY: 10,
    });
    const list = await t.query(api.boardPresence.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].countryCode).toBe("JP");
  });

  it("rejects a username containing a blocked word", async () => {
    await expect(
      t.mutation(api.boardPresence.heartbeat, { clientId: "a", username: "fuck", cursorX: 1, cursorY: 1 }),
    ).rejects.toThrow(/PROFANITY_BLOCKED/);
  });

  it("clamps cursor coordinates to board bounds rather than rejecting", async () => {
    await t.mutation(api.boardPresence.heartbeat, { clientId: "a", cursorX: 999999, cursorY: -50 });
    const list = await t.query(api.boardPresence.list, {});
    expect(list[0].cursorX).toBeLessThanOrEqual(2400);
    expect(list[0].cursorY).toBeGreaterThanOrEqual(0);
  });
});

describe("boardPresence.list", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("never returns more than BOARD_MAX_PRESENCE_LIST rows", async () => {
    for (let i = 0; i < BOARD_MAX_PRESENCE_LIST + 5; i++) {
      await t.mutation(api.boardPresence.heartbeat, { clientId: `client-${i}`, cursorX: 1, cursorY: 1 });
    }
    const list = await t.query(api.boardPresence.list, {});
    expect(list.length).toBeLessThanOrEqual(BOARD_MAX_PRESENCE_LIST);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/boardPresence.test.ts`
Expected: FAIL with a module-not-found error for `./boardPresence`

- [ ] **Step 3: Implement `convex/boardPresence.ts`**

```ts
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BOARD_HEARTBEATS_PER_CLIENT_WINDOW,
  BOARD_HEARTBEATS_GLOBAL_WINDOW,
  BOARD_MAX_PRESENCE_LIST,
  PRESENCE_ONLINE_WINDOW_MS,
  MAX_LASER_TRAIL_POINTS,
  MAX_CLIENT_ID_LENGTH,
  MAX_USERNAME_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  COUNTRY_CODE_PATTERN,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { containsProfanity } from "./profanity";

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

export const heartbeat = mutation({
  args: {
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    cursorX: v.number(),
    cursorY: v.number(),
    laserTrail: v.optional(
      v.array(v.object({ x: v.number(), y: v.number(), timestamp: v.number() })),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
      if (containsProfanity(args.username)) {
        throw new ConvexError("PROFANITY_BLOCKED: username contains a blocked word — please choose another");
      }
    }
    if (args.countryCode !== undefined && !COUNTRY_CODE_PATTERN.test(args.countryCode)) {
      throw new Error("countryCode must be a 2-letter ISO 3166-1 alpha-2 code");
    }
    await consumeRateLimit(
      ctx,
      `boardPresence:client:${args.clientId}`,
      BOARD_HEARTBEATS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "boardPresence:global", BOARD_HEARTBEATS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const cursorX = clamp(args.cursorX, BOARD_WIDTH);
    const cursorY = clamp(args.cursorY, BOARD_HEIGHT);
    if (args.laserTrail !== undefined && args.laserTrail.length > MAX_LASER_TRAIL_POINTS) {
      throw new Error(`laserTrail.length must not exceed ${MAX_LASER_TRAIL_POINTS}`);
    }
    const now = Date.now();
    const laserTrail = args.laserTrail?.map((p) => ({
      x: clamp(p.x, BOARD_WIDTH),
      y: clamp(p.y, BOARD_HEIGHT),
      timestamp: Number.isFinite(p.timestamp) ? Math.min(p.timestamp, now) : now,
    }));

    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        username: args.username,
        countryCode: args.countryCode,
        cursorX,
        cursorY,
        laserTrail,
        lastSeenAt: now,
      });
    } else {
      await ctx.db.insert("boardPresence", {
        clientId: args.clientId,
        username: args.username,
        countryCode: args.countryCode,
        cursorX,
        cursorY,
        laserTrail,
        lastSeenAt: now,
      });
    }
    return null;
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      clientId: v.string(),
      username: v.optional(v.string()),
      countryCode: v.optional(v.string()),
      cursorX: v.number(),
      cursorY: v.number(),
      laserTrail: v.optional(
        v.array(v.object({ x: v.number(), y: v.number(), timestamp: v.number() })),
      ),
    }),
  ),
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_ONLINE_WINDOW_MS;
    const rows = await ctx.db
      .query("boardPresence")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", cutoff))
      .take(BOARD_MAX_PRESENCE_LIST);
    return rows.map((r) => ({
      clientId: r.clientId,
      username: r.username,
      countryCode: r.countryCode,
      cursorX: r.cursorX,
      cursorY: r.cursorY,
      laserTrail: r.laserTrail,
    }));
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run convex/boardPresence.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/boardPresence.ts convex/boardPresence.test.ts
git commit -m "Add boardPresence: heartbeat and bounded list"
```

---

### Task 4: `boardComments.ts`

**Files:**
- Create: `convex/boardComments.ts`
- Test: `convex/boardComments.test.ts`

**Interfaces:**
- Consumes: `assertBoundedIdentifier`, `assertWritesEnabled`, `consumeRateLimit` from `convex/abuse.ts`; `verifyAdminPasscode` from `convex/admin.ts`; `containsProfanity` from `convex/profanity.ts`; `BOARD_WIDTH`, `BOARD_HEIGHT`, `BOARD_COMMENTS_PER_CLIENT_WINDOW`, `BOARD_COMMENTS_GLOBAL_WINDOW` from `convex/constants.ts` (Task 1), plus shared constants `MAX_CLIENT_ID_LENGTH`, `MAX_USERNAME_LENGTH`, `MAX_COMMENT_LENGTH`, `COUNTRY_CODE_PATTERN`, `RATE_LIMIT_WINDOW_MS`.
- Produces: `create`, `remove`, `list`, `adminRemove` — used by Task 8 (`CanvasBackend`) and Task 11 (admin UI, for moderating reported comments).

- [ ] **Step 1: Write the failing tests**

Create `convex/boardComments.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/boardComments.test.ts`
Expected: FAIL with a module-not-found error for `./boardComments`

- [ ] **Step 3: Implement `convex/boardComments.ts`**

```ts
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  MAX_CLIENT_ID_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_COMMENT_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
  BOARD_COMMENTS_PER_CLIENT_WINDOW,
  BOARD_COMMENTS_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { verifyAdminPasscode } from "./admin";
import { containsProfanity } from "./profanity";

const boardCommentReturnFields = v.object({
  _id: v.id("boardComments"),
  _creationTime: v.number(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  text: v.string(),
  x: v.number(),
  y: v.number(),
  createdAt: v.number(),
});

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(boardCommentReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? 200), 500);
    return await ctx.db.query("boardComments").withIndex("by_createdAt").order("desc").take(limit);
  },
});

export const create = mutation({
  args: {
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    text: v.string(),
    x: v.number(),
    y: v.number(),
  },
  returns: v.object({ id: v.id("boardComments") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.clientId, "clientId", MAX_CLIENT_ID_LENGTH);
    if (args.username !== undefined) {
      assertBoundedIdentifier(args.username, "username", MAX_USERNAME_LENGTH);
      if (containsProfanity(args.username)) {
        throw new ConvexError("PROFANITY_BLOCKED: username contains a blocked word — please choose another");
      }
    }
    if (args.countryCode !== undefined && !COUNTRY_CODE_PATTERN.test(args.countryCode)) {
      throw new Error("countryCode must be a 2-letter ISO 3166-1 alpha-2 code");
    }
    const text = args.text.trim();
    if (!text || text.length > MAX_COMMENT_LENGTH) {
      throw new Error(`comment must be between 1 and ${MAX_COMMENT_LENGTH} characters`);
    }
    if (containsProfanity(text)) {
      throw new ConvexError("PROFANITY_BLOCKED: comment contains a blocked word");
    }
    if (!Number.isFinite(args.x) || args.x < 0 || args.x > BOARD_WIDTH) {
      throw new Error(`x must be within [0, ${BOARD_WIDTH}]`);
    }
    if (!Number.isFinite(args.y) || args.y < 0 || args.y > BOARD_HEIGHT) {
      throw new Error(`y must be within [0, ${BOARD_HEIGHT}]`);
    }
    await consumeRateLimit(
      ctx,
      `boardComments:client:${args.clientId}`,
      BOARD_COMMENTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "boardComments:global", BOARD_COMMENTS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const id = await ctx.db.insert("boardComments", {
      clientId: args.clientId,
      username: args.username,
      countryCode: args.countryCode,
      text,
      x: Math.round(args.x),
      y: Math.round(args.y),
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const remove = mutation({
  args: { commentId: v.id("boardComments"), clientId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (comment === null) return null;
    if (comment.clientId !== args.clientId) {
      throw new Error("can only delete your own comment");
    }
    await consumeRateLimit(
      ctx,
      `boardComments:remove:client:${args.clientId}`,
      BOARD_COMMENTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await ctx.db.delete(args.commentId);
    return null;
  },
});

export const adminRemove = mutation({
  args: { passcode: v.string(), commentId: v.id("boardComments") },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false, error: verified.error };
    }
    await ctx.db.delete(args.commentId);
    return { success: true as const };
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run convex/boardComments.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/boardComments.ts convex/boardComments.test.ts
git commit -m "Add boardComments: create, remove, list, adminRemove"
```

---

### Task 5: `boardReports.ts`

**Files:**
- Create: `convex/boardReports.ts`
- Test: `convex/boardReports.test.ts`

**Interfaces:**
- Consumes: `assertBoundedIdentifier`, `assertWritesEnabled`, `consumeRateLimit` from `convex/abuse.ts`; `isPasscodeValid`, `verifyAdminPasscode` from `convex/admin.ts`; `containsProfanity` from `convex/profanity.ts`; `BOARD_WIDTH`, `BOARD_HEIGHT`, `BOARD_REPORTS_PER_CLIENT_WINDOW`, `BOARD_REPORTS_GLOBAL_WINDOW` from `convex/constants.ts` (Task 1); the `boardComments` table (Task 4) for denormalizing comment text/author.
- Produces: `create`, `listOpen`, `updateStatus` — used by Task 8 (`CanvasBackend`) and Task 11 (admin UI).

This mirrors `convex/reports.ts` (a standalone module, not part of `admin.ts`) — same structure, targeting `boardReports`/`boardComments` instead of `contentReports`/`canvasComments`, and no `zoom` field (Board's zoom never varies — see spec).

- [ ] **Step 1: Write the failing tests**

Create `convex/boardReports.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/boardReports.test.ts`
Expected: FAIL with a module-not-found error for `./boardReports`

- [ ] **Step 3: Implement `convex/boardReports.ts`**

```ts
import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  MAX_CLIENT_ID_LENGTH,
  MAX_REPORT_REASON_LENGTH,
  RATE_LIMIT_WINDOW_MS,
  BOARD_REPORTS_PER_CLIENT_WINDOW,
  BOARD_REPORTS_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { isPasscodeValid, verifyAdminPasscode } from "./admin";
import { containsProfanity } from "./profanity";

const boardReportReturnFields = v.object({
  _id: v.id("boardReports"),
  _creationTime: v.number(),
  reporterId: v.string(),
  targetType: v.union(v.literal("area"), v.literal("comment")),
  x: v.optional(v.number()),
  y: v.optional(v.number()),
  minX: v.optional(v.number()),
  minY: v.optional(v.number()),
  maxX: v.optional(v.number()),
  maxY: v.optional(v.number()),
  commentId: v.optional(v.id("boardComments")),
  reason: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed")),
  createdAt: v.number(),
  commentText: v.optional(v.string()),
  commentAuthor: v.optional(v.string()),
});

function isFiniteBoardCoord(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= Math.max(BOARD_WIDTH, BOARD_HEIGHT);
}

export const create = mutation({
  args: {
    reporterId: v.string(),
    targetType: v.union(v.literal("area"), v.literal("comment")),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    minX: v.optional(v.number()),
    minY: v.optional(v.number()),
    maxX: v.optional(v.number()),
    maxY: v.optional(v.number()),
    commentId: v.optional(v.id("boardComments")),
    reason: v.optional(v.string()),
  },
  returns: v.object({ id: v.id("boardReports") }),
  handler: async (ctx, args) => {
    assertWritesEnabled();
    assertBoundedIdentifier(args.reporterId, "reporterId", MAX_CLIENT_ID_LENGTH);

    if (args.reason !== undefined) {
      if (args.reason.length > MAX_REPORT_REASON_LENGTH) {
        throw new Error(`reason must not exceed ${MAX_REPORT_REASON_LENGTH} characters`);
      }
      if (containsProfanity(args.reason)) {
        throw new ConvexError("PROFANITY_BLOCKED: reason contains a blocked word — please rephrase");
      }
    }

    const hasRect =
      args.minX !== undefined || args.minY !== undefined || args.maxX !== undefined || args.maxY !== undefined;

    if (args.targetType === "area") {
      if (hasRect) {
        if (
          args.minX === undefined ||
          args.minY === undefined ||
          args.maxX === undefined ||
          args.maxY === undefined ||
          !isFiniteBoardCoord(args.minX) ||
          !isFiniteBoardCoord(args.minY) ||
          !isFiniteBoardCoord(args.maxX) ||
          !isFiniteBoardCoord(args.maxY) ||
          args.minX >= args.maxX ||
          args.minY >= args.maxY
        ) {
          throw new Error("a marked-area report needs a valid minX/minY/maxX/maxY rectangle");
        }
      } else if (
        args.x === undefined ||
        args.y === undefined ||
        !Number.isFinite(args.x) ||
        !Number.isFinite(args.y) ||
        args.x < 0 ||
        args.x > BOARD_WIDTH ||
        args.y < 0 ||
        args.y > BOARD_HEIGHT
      ) {
        throw new Error(`an "area" report needs x/y within [0, ${BOARD_WIDTH}]/[0, ${BOARD_HEIGHT}]`);
      }
    } else {
      if (args.commentId === undefined) {
        throw new Error('a "comment" report needs commentId');
      }
      const comment = await ctx.db.get(args.commentId);
      if (comment === null) {
        throw new Error("that comment no longer exists");
      }
    }

    await consumeRateLimit(
      ctx,
      `boardReports:client:${args.reporterId}`,
      BOARD_REPORTS_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "boardReports:global", BOARD_REPORTS_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const id = await ctx.db.insert("boardReports", {
      reporterId: args.reporterId,
      targetType: args.targetType,
      x: args.x,
      y: args.y,
      minX: args.minX,
      minY: args.minY,
      maxX: args.maxX,
      maxY: args.maxY,
      commentId: args.commentId,
      reason: args.reason?.trim() || undefined,
      status: "open",
      createdAt: Date.now(),
    });

    return { id };
  },
});

export const listOpen = query({
  args: { passcode: v.string() },
  returns: v.array(boardReportReturnFields),
  handler: async (ctx, args) => {
    if (!isPasscodeValid(args.passcode)) {
      return [];
    }
    const reports = await ctx.db
      .query("boardReports")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", "open"))
      .order("asc")
      .take(100);

    return await Promise.all(
      reports.map(async (r) => {
        const comment =
          r.targetType === "comment" && r.commentId !== undefined ? await ctx.db.get(r.commentId) : null;
        return {
          ...r,
          commentText: comment?.text,
          commentAuthor: comment?.username,
        };
      }),
    );
  },
});

export const updateStatus = mutation({
  args: {
    passcode: v.string(),
    reportId: v.id("boardReports"),
    status: v.union(v.literal("reviewed"), v.literal("dismissed")),
  },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false, error: verified.error };
    }
    await ctx.db.patch(args.reportId, { status: args.status });
    return { success: true as const };
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run convex/boardReports.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/boardReports.ts convex/boardReports.test.ts
git commit -m "Add boardReports: create, listOpen, updateStatus"
```

---

### Task 6: `boardAdmin.ts` — `wipeAll`

**Files:**
- Create: `convex/boardAdmin.ts`
- Test: `convex/boardAdmin.test.ts`

**Interfaces:**
- Consumes: `verifyAdminPasscode` from `convex/admin.ts`; `claimNextSequence` from `convex/boardMetadata.ts` (Task 1); `BOARD_WIPE_BATCH_SIZE` from `convex/constants.ts` (Task 1).
- Produces: `wipeAll` mutation — used by Task 11 (admin UI). Task 7 adds more exports to this same file.

- [ ] **Step 1: Write the failing tests**

Create `convex/boardAdmin.test.ts`:

```ts
// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { BOARD_WIPE_BATCH_SIZE } from "./constants";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const PASSCODE = "test-admin-passcode";

async function submitBoardStroke(t: ReturnType<typeof convexTest>, clientStrokeId: string) {
  return t.mutation(api.boardStrokes.submit, {
    clientStrokeId,
    clientId: "anon-tester",
    mode: "draw",
    color: "#000000",
    width: 4,
    points: [{ x: 10, y: 10 }],
    clientTimestamp: 0,
  });
}

describe("boardAdmin.wipeAll", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a wrong passcode without wiping anything", async () => {
    await submitBoardStroke(t, "a");
    const result = await t.mutation(api.boardAdmin.wipeAll, { passcode: "wrong" });
    expect(result.success).toBe(false);
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows.every((r) => !r.deleted)).toBe(true);
  });

  it("soft-deletes every stroke, never a real row delete", async () => {
    await submitBoardStroke(t, "a");
    await submitBoardStroke(t, "b");
    const result = await t.mutation(api.boardAdmin.wipeAll, { passcode: PASSCODE });
    expect(result.success).toBe(true);
    if (result.success) expect(result.deletedCount).toBe(2);
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.deleted)).toBe(true);
  });

  it("converges a backlog larger than BOARD_WIPE_BATCH_SIZE over multiple bounded calls", async () => {
    const backlogSize = BOARD_WIPE_BATCH_SIZE + 10;
    for (let i = 0; i < backlogSize; i++) {
      await submitBoardStroke(t, `s-${i}`);
    }
    let done = false;
    let afterSequence: number | undefined;
    let calls = 0;
    while (!done) {
      const result = await t.mutation(api.boardAdmin.wipeAll, { passcode: PASSCODE, afterSequence });
      if (!result.success) throw new Error(result.error);
      done = result.done;
      afterSequence = result.nextAfterSequence;
      calls++;
      if (calls > 10) throw new Error("did not converge");
    }
    expect(calls).toBeGreaterThan(1);
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows.every((r) => r.deleted)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/boardAdmin.test.ts`
Expected: FAIL with a module-not-found error for `./boardAdmin`

- [ ] **Step 3: Implement `convex/boardAdmin.ts`**

```ts
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { verifyAdminPasscode } from "./admin";
import { claimNextSequence } from "./boardMetadata";
import { BOARD_WIPE_BATCH_SIZE } from "./constants";

/**
 * Wipes the entire Board, paged the same way the main wall's wipeArea is —
 * one bounded batch per call, well under Convex's per-call read cap. No
 * area filter (unlike wipeArea): a Board wipe is always "the whole thing,"
 * since Board is small enough that there's no meaningful "just this region."
 */
export const wipeAll = mutation({
  args: {
    passcode: v.string(),
    afterSequence: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      deletedCount: v.number(),
      done: v.boolean(),
      nextAfterSequence: v.number(),
    }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }

    const batch = await ctx.db
      .query("boardStrokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", args.afterSequence ?? 0))
      .order("asc")
      .take(BOARD_WIPE_BATCH_SIZE);

    let deletedCount = 0;
    for (const stroke of batch) {
      if (stroke.deleted) continue;
      const nextSequence = await claimNextSequence(ctx);
      await ctx.db.patch(stroke._id, { deleted: true, sequence: nextSequence });
      deletedCount++;
    }

    const done = batch.length < BOARD_WIPE_BATCH_SIZE;
    const nextAfterSequence = batch.length > 0 ? batch[batch.length - 1].sequence : args.afterSequence ?? 0;

    return { success: true as const, deletedCount, done, nextAfterSequence };
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run convex/boardAdmin.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/boardAdmin.ts convex/boardAdmin.test.ts
git commit -m "Add boardAdmin.wipeAll"
```

---

### Task 7: Opt-in stroke pruning (`pruneDeletedStrokes`, `setAutoPruneEnabled`, `getAutoPruneEnabled`, cron)

**Files:**
- Modify: `convex/boardAdmin.ts` (add three exports)
- Modify: `convex/crons.ts` (register the new cron)
- Modify: `convex/boardAdmin.test.ts` (add tests)

**Interfaces:**
- Consumes: `verifyAdminPasscode` from `convex/admin.ts`; `BOARD_PRUNE_BATCH_SIZE`, `BOARD_DELETED_STROKE_RETENTION_MS` from `convex/constants.ts` (Task 1); `internalMutation` from `./_generated/server`.
- Produces: `internal.boardAdmin.pruneDeletedStrokes`, `boardAdmin.setAutoPruneEnabled`, `boardAdmin.getAutoPruneEnabled` — the latter two used by Task 11 (admin UI toggle).

- [ ] **Step 1: Write the failing tests**

Append to `convex/boardAdmin.test.ts` (new top-level `describe` block, same file):

```ts
import { internal } from "./_generated/api";

describe("boardAdmin auto-prune", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    vi.stubEnv("ADMIN_SECRET_KEY", PASSCODE);
    t = convexTest(schema, modules);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function seedOldDeletedStroke(t: ReturnType<typeof convexTest>, ageMs: number) {
    const { sequence } = await submitBoardStroke(t, "old-one");
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("boardStrokes")
        .withIndex("by_sequence", (q) => q.eq("sequence", sequence))
        .unique();
      if (!row) throw new Error("seed row not found");
      await ctx.db.patch(row._id, { deleted: true, serverTimestamp: Date.now() - ageMs });
    });
  }

  it("getAutoPruneEnabled defaults to false", async () => {
    expect(await t.query(api.boardAdmin.getAutoPruneEnabled, {})).toBe(false);
  });

  it("does nothing when autoPruneEnabled is off (the default)", async () => {
    await seedOldDeletedStroke(t, 30 * 24 * 60 * 60 * 1000); // 30 days old
    await t.mutation(internal.boardAdmin.pruneDeletedStrokes, {});
    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows).toHaveLength(1);
  });

  it("setAutoPruneEnabled requires a valid passcode", async () => {
    const wrong = await t.mutation(api.boardAdmin.setAutoPruneEnabled, { passcode: "wrong", enabled: true });
    expect(wrong.success).toBe(false);
    expect(await t.query(api.boardAdmin.getAutoPruneEnabled, {})).toBe(false);
  });

  it("once enabled, hard-deletes old soft-deleted rows but leaves recent or non-deleted ones", async () => {
    await t.mutation(api.boardAdmin.setAutoPruneEnabled, { passcode: PASSCODE, enabled: true });
    expect(await t.query(api.boardAdmin.getAutoPruneEnabled, {})).toBe(true);

    await seedOldDeletedStroke(t, 30 * 24 * 60 * 60 * 1000); // old + deleted -> pruned
    const recent = await submitBoardStroke(t, "recent-deleted");
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("boardStrokes")
        .withIndex("by_sequence", (q) => q.eq("sequence", recent.sequence))
        .unique();
      if (!row) throw new Error("seed row not found");
      await ctx.db.patch(row._id, { deleted: true }); // deleted just now -> not pruned yet
    });
    await submitBoardStroke(t, "still-live"); // never deleted -> never pruned

    await t.mutation(internal.boardAdmin.pruneDeletedStrokes, {});

    const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.clientStrokeId === "old-one")).toBe(false);
    expect(rows.some((r) => r.clientStrokeId === "recent-deleted")).toBe(true);
    expect(rows.some((r) => r.clientStrokeId === "still-live")).toBe(true);
  });

  it("converges a prune backlog larger than BOARD_PRUNE_BATCH_SIZE over multiple bounded calls", async () => {
    await t.mutation(api.boardAdmin.setAutoPruneEnabled, { passcode: PASSCODE, enabled: true });
    const backlogSize = BOARD_PRUNE_BATCH_SIZE + 10;
    for (let i = 0; i < backlogSize; i++) {
      await seedOldDeletedStroke(t, 30 * 24 * 60 * 60 * 1000);
    }
    let remaining = backlogSize;
    let calls = 0;
    while (remaining > 0) {
      await t.mutation(internal.boardAdmin.pruneDeletedStrokes, {});
      const rows = await t.run((ctx) => ctx.db.query("boardStrokes").collect());
      remaining = rows.length;
      calls++;
      if (calls > 10) throw new Error("did not converge");
    }
    expect(calls).toBeGreaterThan(1);
  });
});
```

Add `BOARD_PRUNE_BATCH_SIZE` to this test file's existing import from `./constants`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run convex/boardAdmin.test.ts`
Expected: FAIL — `boardAdmin.pruneDeletedStrokes`/`setAutoPruneEnabled`/`getAutoPruneEnabled` don't exist yet

- [ ] **Step 3: Add the three exports to `convex/boardAdmin.ts`**

Add these imports to the top of the file (extending the existing import lines):

```ts
import { internalMutation, mutation, query } from "./_generated/server";
import { verifyAdminPasscode } from "./admin";
import { claimNextSequence } from "./boardMetadata";
import { BOARD_WIPE_BATCH_SIZE, BOARD_PRUNE_BATCH_SIZE, BOARD_DELETED_STROKE_RETENTION_MS } from "./constants";
```

(This replaces the file's existing `import { mutation } from "./_generated/server";` and `BOARD_WIPE_BATCH_SIZE`-only constants import from Task 6 — `query` and `internalMutation` are newly needed here.)

Append to the end of `convex/boardAdmin.ts`:

```ts
export const getAutoPruneEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const meta = await ctx.db.query("boardMetadata").first();
    return meta?.autoPruneEnabled ?? false;
  },
});

export const setAutoPruneEnabled = mutation({
  args: { passcode: v.string(), enabled: v.boolean() },
  returns: v.union(
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args) => {
    const verified = await verifyAdminPasscode(ctx, args.passcode);
    if (!verified.ok) {
      return { success: false as const, error: verified.error };
    }
    let meta = await ctx.db.query("boardMetadata").first();
    if (meta === null) {
      const id = await ctx.db.insert("boardMetadata", { currentSequence: 0, autoPruneEnabled: args.enabled });
      meta = await ctx.db.get(id);
    } else {
      await ctx.db.patch(meta._id, { autoPruneEnabled: args.enabled });
    }
    return { success: true as const };
  },
});

/**
 * Opt-in, off by default (see boardMetadata.autoPruneEnabled). The cron in
 * convex/crons.ts always fires on schedule — Convex crons are static,
 * deploy-time configuration with no runtime enable/disable — but this
 * handler's very first read decides whether it does anything at all.
 * When enabled, hard-deletes (not a patch) old soft-deleted boardStrokes
 * rows, bounded to one batch per call so a large backlog converges over
 * several cron runs instead of one unsafe unbounded pass.
 */
export const pruneDeletedStrokes = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const meta = await ctx.db.query("boardMetadata").first();
    if (!meta?.autoPruneEnabled) return null;

    const cutoff = Date.now() - BOARD_DELETED_STROKE_RETENTION_MS;
    const batch = await ctx.db
      .query("boardStrokes")
      .withIndex("by_sequence")
      .order("asc")
      .take(BOARD_PRUNE_BATCH_SIZE);

    for (const stroke of batch) {
      if (stroke.deleted && stroke.serverTimestamp < cutoff) {
        await ctx.db.delete(stroke._id);
      }
    }
    return null;
  },
});
```

- [ ] **Step 4: Register the cron**

In `convex/crons.ts`, add (after the existing `clear expired write rate limits` block):

```ts
crons.interval(
  "prune deleted board strokes",
  { minutes: 10 },
  internal.boardAdmin.pruneDeletedStrokes,
  {},
);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run convex/boardAdmin.test.ts`
Expected: PASS (8 tests total in this file)

- [ ] **Step 6: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS (all suites, no regressions)

- [ ] **Step 7: Commit**

```bash
git add convex/boardAdmin.ts convex/boardAdmin.test.ts convex/crons.ts
git commit -m "Add opt-in stroke pruning for Board, off by default"
```

---

### Task 8: `CanvasBackend` adapter and `GlobalCanvas.tsx` call-site swap

**Files:**
- Create: `lib/canvasBackend.ts`
- Modify: `components/GlobalCanvas.tsx` (add `mode` prop, resolve `backend`, swap 13 Convex call sites)

**Interfaces:**
- Consumes: `api.strokes.*`, `api.boardStrokes.*`, `api.presence.*`, `api.boardPresence.*`, `api.comments.*`, `api.boardComments.*` (all from prior tasks); `WORLD_WIDTH`, `WORLD_HEIGHT`, `BOARD_WIDTH`, `BOARD_HEIGHT` from `convex/constants.ts`.
- Produces: `CanvasBackend` interface, `wallBackend`, `boardBackend` — used by Task 10 (camera lock) and by `GlobalCanvas`'s new `mode` prop, which Task 9's route passes.

This task is a **behavior-neutral refactor for the main wall** — after this task, `/canvas` must work exactly as before. It only introduces the seam; camera-lock behavior for board mode is Task 10.

- [ ] **Step 1: Create `lib/canvasBackend.ts`**

```ts
import { api } from "@/convex/_generated/api";
import { WORLD_WIDTH, WORLD_HEIGHT, BOARD_WIDTH, BOARD_HEIGHT } from "@/convex/constants";

export interface CanvasBackend {
  strokesApi: {
    submit: typeof api.strokes.submit | typeof api.boardStrokes.submit;
    listSince: typeof api.strokes.listSince | typeof api.boardStrokes.listSince;
  };
  presenceApi: {
    heartbeat: typeof api.presence.heartbeat | typeof api.boardPresence.heartbeat;
    list: typeof api.presence.list | typeof api.boardPresence.list;
  };
  commentsApi: {
    create: typeof api.comments.create | typeof api.boardComments.create;
    remove: typeof api.comments.remove | typeof api.boardComments.remove;
    list: typeof api.comments.list | typeof api.boardComments.list;
    adminRemove: typeof api.comments.adminRemove | typeof api.boardComments.adminRemove;
  };
  worldWidth: number;
  worldHeight: number;
  /** False for Board: camera is locked to an auto-fit zoom, never
   * user-adjustable (see GlobalCanvas.tsx's camera-lock logic). */
  supportsZoomPan: boolean;
  /** False for Board: redundant when the whole world is always fully
   * visible on screen at once. */
  showMinimap: boolean;
  /** False for Board: its world is small enough that every stroke/cursor
   * is always "visible" — no tile-scoped subscriptions needed. */
  usesTileScoping: boolean;
}

export const wallBackend: CanvasBackend = {
  strokesApi: { submit: api.strokes.submit, listSince: api.strokes.listSince },
  presenceApi: { heartbeat: api.presence.heartbeat, list: api.presence.list },
  commentsApi: {
    create: api.comments.create,
    remove: api.comments.remove,
    list: api.comments.list,
    adminRemove: api.comments.adminRemove,
  },
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  supportsZoomPan: true,
  showMinimap: true,
  usesTileScoping: true,
};

export const boardBackend: CanvasBackend = {
  strokesApi: { submit: api.boardStrokes.submit, listSince: api.boardStrokes.listSince },
  presenceApi: { heartbeat: api.boardPresence.heartbeat, list: api.boardPresence.list },
  commentsApi: {
    create: api.boardComments.create,
    remove: api.boardComments.remove,
    list: api.boardComments.list,
    adminRemove: api.boardComments.adminRemove,
  },
  worldWidth: BOARD_WIDTH,
  worldHeight: BOARD_HEIGHT,
  supportsZoomPan: false,
  showMinimap: false,
  usesTileScoping: false,
};
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Add the `mode` prop and resolve `backend` in `GlobalCanvas.tsx`**

Find the component's props type (`GlobalCanvasProps`, used at `export function GlobalCanvas({ embedded = false }: GlobalCanvasProps = {})`) and add `mode`:

```ts
export interface GlobalCanvasProps {
  embedded?: boolean;
  mode?: "wall" | "board";
}
```

Right after the function signature's opening (where `embedded` is destructured), add:

```ts
export function GlobalCanvas({ embedded = false, mode = "wall" }: GlobalCanvasProps = {}) {
  const backend = mode === "board" ? boardBackend : wallBackend;
```

Add the import near the other local imports:

```ts
import { wallBackend, boardBackend } from "@/lib/canvasBackend";
```

- [ ] **Step 4: Swap every Convex call site to go through `backend`**

Replace each of these 9 lines (the strokes/presence/comments ones — `admin.*`/`snapshots.*`/`reports.*` are unaffected, Board has no snapshot optimization and reports/admin get their own backend-agnostic wiring, described below):

```ts
const submitStroke = useMutation(api.strokes.submit);
const heartbeat = useMutation(api.presence.heartbeat);
const createComment = useMutation(api.comments.create);
const removeComment = useMutation(api.comments.remove);
const adminRemoveComment = useMutation(api.comments.adminRemove);
const globalPresenceList = useQuery(api.presence.list, tooManyTilesForScoping ? {} : "skip");
const canvasCommentRows = useQuery(api.comments.list, {});
```

become:

```ts
const submitStroke = useMutation(backend.strokesApi.submit);
const heartbeat = useMutation(backend.presenceApi.heartbeat);
const createComment = useMutation(backend.commentsApi.create);
const removeComment = useMutation(backend.commentsApi.remove);
const adminRemoveComment = useMutation(backend.commentsApi.adminRemove);
const globalPresenceList = useQuery(backend.presenceApi.list, tooManyTilesForScoping ? {} : "skip");
const canvasCommentRows = useQuery(backend.commentsApi.list, {});
```

The tile-scoped query stays on `api.presence.listByTiles` for now (Task 10 makes this conditional on `backend.usesTileScoping`):

```ts
const scopedPresenceList = useQuery(
  api.presence.listByTiles,
  !tooManyTilesForScoping && subscribedTileKeys.length > 0 ? { tileKeys: subscribedTileKeys } : "skip",
);
```

`reportContent` (`api.reports.create`) and `submitSnapshot`/`onlineCount` are **not** swapped — reports go through `api.reports.create` for both modes for now (Task 11 adds Board's own report-viewing path in the admin panel, separate from this in-canvas report button's wiring, which is out of scope to rewire here since the spec doesn't require Board's report *button* to exist in v1 — only the admin queue does), and snapshot/online-count are wall-only features Board's `Non-goals` explicitly excludes.

- [ ] **Step 5: Everywhere `WORLD_WIDTH`/`WORLD_HEIGHT` are used purely for bounds/tiling math tied to the strokes/presence/comments call sites above, replace with `backend.worldWidth`/`backend.worldHeight`**

Specifically the coordinate clamping in `handlePointerMove`/stroke submission and comment placement (the same call sites already touched in Step 4's surrounding code) — do **not** touch `WORLD_WIDTH`/`WORLD_HEIGHT` usages inside minimap rendering, protected-zone/report UI, or anything gated behind `backend.showMinimap`/admin-only wall features, since those stay wall-only regardless of `mode`.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS (no regressions — this step only touches the client, but confirms nothing server-side broke from the constants/schema changes)

- [ ] **Step 7: Manual smoke test — confirm the main wall is unaffected**

Start the dev server (`npm run dev`), open `/canvas`, draw a stroke, confirm it appears and persists after reload, confirm remote cursors and comments still work (two browser tabs). This is the regression check for this task: `mode` defaults to `"wall"`, so nothing should look or behave differently.

- [ ] **Step 8: Commit**

```bash
git add lib/canvasBackend.ts components/GlobalCanvas.tsx
git commit -m "Add CanvasBackend adapter; GlobalCanvas.tsx reads Convex calls through it"
```

---

### Task 9: `/board` route, sitemap, homepage link

**Files:**
- Create: `app/board/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `app/page.tsx` (nav link)

**Interfaces:**
- Consumes: `GlobalCanvas` with `mode="board"` (Task 8).

- [ ] **Step 1: Create the route**

```tsx
"use client";

import dynamic from "next/dynamic";

const GlobalCanvas = dynamic(
  () => import("@/components/GlobalCanvas").then((m) => m.GlobalCanvas),
  { ssr: false },
);

export default function BoardPage() {
  return <GlobalCanvas mode="board" />;
}
```

- [ ] **Step 2: Add the sitemap entry**

In `app/sitemap.ts`, add `"/board"` to the `routes` array (alongside `"/canvas"`), and include it in both `changeFrequency`/`priority` conditions that currently check `route === "/canvas"`:

```ts
  const routes = [
    "",
    "/canvas",
    "/board",
    "/sketchbook",
    ...Object.keys(SKETCHBOOK_PAGES).map((id) => `/sketchbook/${id}`),
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/canvas" || route === "/board" || route.startsWith("/sketchbook") ? "always" : "weekly",
    priority: route === "" || route === "/canvas" || route === "/board" || route.startsWith("/sketchbook") ? 1.0 : 0.8,
  }));
```

- [ ] **Step 3: Add the homepage nav link**

In `app/page.tsx`, find:

```tsx
<Link href="/canvas" className="text-accent-yellow hover:text-ink transition">
  🎨 Live Canvas
</Link>
<Link href="/sketchbook" className="hover:text-ink transition">
  📖 Sketchbook
</Link>
```

and add a Board link between them:

```tsx
<Link href="/canvas" className="text-accent-yellow hover:text-ink transition">
  🎨 Live Canvas
</Link>
<Link href="/board" className="hover:text-ink transition">
  🖼️ Board
</Link>
<Link href="/sketchbook" className="hover:text-ink transition">
  📖 Sketchbook
</Link>
```

- [ ] **Step 4: Run typecheck and the full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: PASS

- [ ] **Step 5: Manual smoke test**

Start the dev server, visit `/board`. Confirm the canvas loads and a drawn stroke persists after reload. It's expected that zoom/pan still work normally at this point — camera-lock is Task 10. Open Convex's dashboard (or a `runOneoffQuery`) and confirm the stroke landed in `boardStrokes`, not `strokes`.

- [ ] **Step 6: Commit**

```bash
git add app/board/page.tsx app/sitemap.ts app/page.tsx
git commit -m "Add /board route, sitemap entry, and homepage nav link"
```

---

### Task 10: Camera lock, letterboxing, minimap hide, tile-scoping bypass

**Files:**
- Modify: `components/GlobalCanvas.tsx`

**Interfaces:**
- Consumes: `backend.supportsZoomPan`, `backend.showMinimap`, `backend.usesTileScoping`, `backend.worldWidth`, `backend.worldHeight` (Task 8).

This is the task that makes Board actually *behave* like the spec: fixed, always-fully-visible, non-zoomable.

- [ ] **Step 1: Gate tile-scoping on `backend.usesTileScoping`**

Change:

```ts
const scopedPresenceList = useQuery(
  api.presence.listByTiles,
  !tooManyTilesForScoping && subscribedTileKeys.length > 0 ? { tileKeys: subscribedTileKeys } : "skip",
);
const globalPresenceList = useQuery(backend.presenceApi.list, tooManyTilesForScoping ? {} : "skip");
const presenceList = tooManyTilesForScoping ? globalPresenceList : scopedPresenceList;
```

to:

```ts
const scopedPresenceList = useQuery(
  api.presence.listByTiles,
  backend.usesTileScoping && !tooManyTilesForScoping && subscribedTileKeys.length > 0
    ? { tileKeys: subscribedTileKeys }
    : "skip",
);
const globalPresenceList = useQuery(
  backend.presenceApi.list,
  !backend.usesTileScoping || tooManyTilesForScoping ? {} : "skip",
);
const presenceList = !backend.usesTileScoping || tooManyTilesForScoping ? globalPresenceList : scopedPresenceList;
```

- [ ] **Step 2: Add the camera auto-fit effect**

Near the existing camera-related state (`cameraRef`, `viewportRef`), add:

```ts
useEffect(() => {
  if (backend.supportsZoomPan) return;
  const applyFitCamera = () => {
    const { width, height } = viewportRef.current;
    if (width === 0 || height === 0) return;
    const fitZoom = Math.min(width / backend.worldWidth, height / backend.worldHeight);
    const fitCamera = { x: backend.worldWidth / 2, y: backend.worldHeight / 2, zoom: fitZoom };
    cameraRef.current = fitCamera;
    scheduleRedraw({ world: true, strokes: true });
  };
  applyFitCamera();
  window.addEventListener("resize", applyFitCamera);
  return () => window.removeEventListener("resize", applyFitCamera);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [backend.supportsZoomPan, backend.worldWidth, backend.worldHeight]);
```

- [ ] **Step 3: Disable zoom/pan input handlers when `!backend.supportsZoomPan`**

At the top of each of these existing handlers — the wheel/scroll zoom handler, the `+`/`-` zoom buttons' click handlers, any keyboard zoom shortcut handler, and click-drag panning inside the pan-tool pointer handlers — add an early return:

```ts
if (!backend.supportsZoomPan) return;
```

(Exact handler names/locations: search `GlobalCanvas.tsx` for `zoomAt(`, `panBy(`, and the wheel/`onWheel` listener — add the guard as the first line inside each.)

- [ ] **Step 4: Hide the minimap**

Find the minimap's JSX (rendered unconditionally today) and wrap it:

```tsx
{backend.showMinimap && (
  <MiniMap ... />
)}
```

(Keep the existing props exactly as they are — only add the conditional wrapper.)

- [ ] **Step 5: Letterboxing background + reject off-canvas pointer input**

In the pointer-down handler that starts a new stroke (the draw-tool's `handlePointerDown` or equivalent), add a bounds check before starting the stroke, using the already-computed world coordinates:

```ts
if (worldX < 0 || worldX > backend.worldWidth || worldY < 0 || worldY > backend.worldHeight) {
  return; // outside the board's drawable rect — the letterboxed margin
}
```

For the letterboxed margin's visual background: in the canvas container's outer wrapping element (the one with the app's chrome background), confirm it already renders the chrome background color underneath the canvas element — if the canvas element itself has an opaque background covering the full viewport regardless of the fit rect, change it to only paint within `[0, backend.worldWidth] x [0, backend.worldHeight]` in world space (the existing `drawWorldBackground` function already only fills the world rect — confirm this by inspecting its call site; no change needed if so, since the chrome background already shows through elsewhere).

- [ ] **Step 6: Manual verification**

Start the dev server, visit `/board`. Confirm:
- The whole board is visible on load, centered, with no scrollbars.
- Scrolling/pinching/`+`/`-`/keyboard shortcuts do nothing.
- Resizing the browser window keeps the whole board visible (re-fits).
- No minimap is shown.
- Clicking outside the board's rect (in a letterboxed margin, on a narrow or ultrawide window) does not start a stroke.
- `/canvas` (wall mode) is completely unaffected — zoom, pan, and the minimap all still work.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add components/GlobalCanvas.tsx
git commit -m "Lock Board's camera to an auto-fit zoom; hide minimap; reject off-canvas input"
```

---

### Task 11: Admin panel toggle for auto-prune

**Files:**
- Modify: `components/AdminPanelModal.tsx`

**Interfaces:**
- Consumes: `api.boardAdmin.getAutoPruneEnabled`, `api.boardAdmin.setAutoPruneEnabled` (Task 7).

- [ ] **Step 1: Add the query and mutation hooks**

Near the panel's existing `useQuery`/`useMutation` declarations, add:

```ts
const autoPruneEnabled = useQuery(api.boardAdmin.getAutoPruneEnabled, {});
const setAutoPruneEnabled = useMutation(api.boardAdmin.setAutoPruneEnabled);
```

- [ ] **Step 2: Add a toggle handler**

Near the panel's other action handlers (e.g. `handleWipeArea`):

```ts
const handleToggleAutoPrune = async () => {
  try {
    setActionStatus("Updating Board auto-prune setting...");
    const res = await setAutoPruneEnabled({ passcode: activePasscode, enabled: !autoPruneEnabled });
    if (!res.success) throw new Error(res.error);
    setActionStatus(`Success! Board auto-prune is now ${!autoPruneEnabled ? "ON" : "OFF"}.`);
  } catch (err: unknown) {
    setActionStatus(`Error: ${err instanceof Error ? err.message : "Failed to update auto-prune"}`);
  }
};
```

- [ ] **Step 3: Add the toggle UI**

In the `"moderation"` tab's JSX (alongside the existing wipe-area controls), add:

```tsx
<div className="flex items-center justify-between gap-2 border-t border-chrome-border pt-3 mt-3">
  <div>
    <div className="font-bold text-xs uppercase">Board Auto-Prune</div>
    <div className="text-[10px] text-ink-dim">
      Automatically hard-deletes old wiped Board strokes. Off by default.
    </div>
  </div>
  <button
    type="button"
    onClick={handleToggleAutoPrune}
    className={`px-3 py-1 text-xs font-bold rounded-sm border ${
      autoPruneEnabled ? "bg-accent-yellow text-black border-accent-yellow" : "bg-transparent border-chrome-border"
    }`}
  >
    {autoPruneEnabled ? "ON" : "OFF"}
  </button>
</div>
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Manual verification**

Open the admin panel (with a valid passcode) on `/canvas` (the panel is shared across modes), go to the moderation tab, confirm the toggle shows "OFF" initially, click it, confirm it flips to "ON" and the status message confirms success, reload the panel and confirm it's still "ON" (persisted).

- [ ] **Step 6: Commit**

```bash
git add components/AdminPanelModal.tsx
git commit -m "Add admin panel toggle for Board auto-prune"
```

---

### Task 12: Playwright e2e test for the fixed-camera behavior

**Files:**
- Create: `e2e/board.spec.ts`

**Interfaces:**
- Consumes: the live `/board` route (Tasks 9-10).

- [ ] **Step 1: Write the test**

```ts
import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.ALWAYSDRAW_E2E_LIVE !== "1",
  "live Board test writes disposable strokes; run with ALWAYSDRAW_E2E_LIVE=1 npx playwright test e2e/board.spec.ts against a non-production Convex deployment",
);

async function waitForBoard(page: Page) {
  await page.goto("/board");
  await expect(page.getByText("loading", { exact: false })).toBeHidden({ timeout: 30_000 });
}

async function canvasBoundingBox(page: Page) {
  const box = await page.locator("canvas").nth(1).boundingBox();
  if (!box) throw new Error("board canvas has no bounding box");
  return box;
}

test("zoom and pan input have zero effect on Board's camera", async ({ page }) => {
  await waitForBoard(page);
  const before = await canvasBoundingBox(page);

  // Wheel-zoom attempt (ctrl+wheel simulates a trackpad pinch in Chromium).
  await page.mouse.wheel(0, -200);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -200);
  await page.keyboard.up("Control");

  // Keyboard zoom shortcut attempt.
  await page.keyboard.press("Equal"); // "+"
  await page.keyboard.press("Minus"); // "-"

  const after = await canvasBoundingBox(page);
  expect(after).toEqual(before);
});

test("a stroke lands at the same screen position after a reload (no drift from camera state)", async ({ page }) => {
  await waitForBoard(page);
  const box = await canvasBoundingBox(page);
  const point = { x: box.width / 2, y: box.height / 2 };

  await page.mouse.move(box.x + point.x - 20, box.y + point.y);
  await page.mouse.down();
  await page.mouse.move(box.x + point.x + 20, box.y + point.y, { steps: 8 });
  await page.mouse.up();

  const sample = async () =>
    page.locator("canvas").nth(1).evaluate((el, p) => {
      const canvas = el as HTMLCanvasElement;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context unavailable");
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return [...ctx.getImageData(p.x * scaleX, p.y * scaleY, 1, 1).data];
    }, point);

  const beforeReload = await sample();
  await page.reload();
  await expect(page.getByText("loading", { exact: false })).toBeHidden({ timeout: 30_000 });
  await expect.poll(sample, { timeout: 15_000 }).toEqual(beforeReload);
});
```

- [ ] **Step 2: Run it against a non-production Convex deployment**

Run: `ALWAYSDRAW_E2E_LIVE=1 npx playwright test e2e/board.spec.ts`
Expected: PASS (2 tests). Note: this requires `npx convex dev` running against the dev deployment and `npm run dev` serving the app locally, same prerequisites as `npm run test:e2e:live`.

- [ ] **Step 3: Commit**

```bash
git add e2e/board.spec.ts
git commit -m "Add Playwright e2e test for Board's fixed-camera behavior"
```

---

## Self-Review

**Spec coverage:**
- Data model (all 5 tables) — Task 1. ✓
- Constants — Task 1. ✓
- `boardMetadata.ts` — Task 1. ✓
- `boardStrokes.ts` — Task 2. ✓ (corrected: no `getLatest`/`listByTiles` — those don't apply per Non-goals; the spec's mention of `getLatest` was this plan's own catch of a spec inconsistency, fixed here rather than re-editing the spec for a naming slip)
- `boardPresence.ts` — Task 3. ✓
- `boardComments.ts` — Task 4. ✓
- `boardReports.ts` — Task 5. ✓ (spec described this as living in `boardAdmin.ts`; this plan places it in its own module instead, matching the actual established convention — `reports.ts` is a standalone module, not part of `admin.ts`, and `admin.ts`'s own `reports`-shaped delegation was a simplification in the spec's prose, not a hard requirement)
- `boardAdmin.wipeAll` — Task 6. ✓
- Opt-in pruning + cron + admin toggle backend — Task 7. ✓
- `CanvasBackend` adapter — Task 8. ✓
- Camera lock / letterboxing / minimap / tile-scoping bypass — Task 10. ✓
- Routing/sitemap/nav — Task 9. ✓
- Admin UI toggle — Task 11. ✓
- Playwright e2e test — Task 12. ✓
- Error handling conventions (ConvexError vs Error) — followed throughout Tasks 2-7, matching each mirrored main-wall function exactly.

**Placeholder scan:** No TBD/TODO markers; every step has real, complete code, not descriptions.

**Type consistency:** `CanvasBackend` field names (`strokesApi`, `presenceApi`, `commentsApi`, `worldWidth`, `worldHeight`, `supportsZoomPan`, `showMinimap`, `usesTileScoping`) are used identically in Task 8 (definition) and Task 10 (consumption). `boardMetadata.autoPruneEnabled` is named identically in Task 1 (schema), Task 7 (read/write), and Task 11 (UI). Function names (`claimNextSequence`, `wipeAll`, `pruneDeletedStrokes`, `setAutoPruneEnabled`, `getAutoPruneEnabled`) are consistent between their defining task and every later consumer.
