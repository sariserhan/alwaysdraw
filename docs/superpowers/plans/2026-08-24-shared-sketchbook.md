# Shared Sketchbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/sketchbook`, a second shared real-time canvas where everyone colors one fixed line-art outline together — paint is clipped to the outline's regions and the outline itself is never erasable.

**Architecture:** A new, self-contained `SketchbookCanvas` component (not built on `GlobalCanvas`) renders a paint `<canvas>` under a static, `pointer-events: none` `<svg>` line-art overlay. Region containment and clip-path generation come from one pure-data/pure-function module (`lib/sketchbookOutline.ts`) shared by both the browser and Convex's server runtime. Storage is a new, separate pair of Convex tables (`sketchbookStrokes`, `sketchbookMetadata`) that closely mirror the existing `strokes`/`canvasMetadata` pattern, reusing the same validation, rate-limiting, idempotency, and incremental-sync-by-sequence machinery.

**Tech Stack:** Next.js (App Router), Convex, `convex-test` + Vitest, Tailwind v4, Canvas 2D API.

**Spec:** `docs/superpowers/specs/2026-08-24-shared-sketchbook-design.md`

## Global Constraints

- No new npm dependencies — everything reuses what's already in `package.json`.
- No DOM APIs (`Path2D`, canvas contexts) in any module also imported by Convex functions or exercised by a Vitest test — this repo's test setup has no jsdom/`canvas` polyfill (`vitest.config.ts` uses `environment: "node"`, per-file `edge-runtime` for Convex tests).
- Region ids and page dimensions live in exactly one place (`lib/sketchbookOutline.ts`); Convex imports them directly rather than a mirrored copy.
- New Convex tables/functions are separate from `strokes`/`canvasMetadata` — do not modify the main canvas's schema or functions.
- Reuse existing helpers as-is wherever the spec says to: `lib/drawing.ts` (`drawStroke`/`drawSegment`), `lib/strokeBuffer.ts` (`StrokeBuffer`), `lib/identity.ts`, `lib/coordinates.ts` (`screenToWorld`/`worldToScreen`), `lib/palettes.ts` (`PALETTE_PRESETS`), `convex/abuse.ts` (`assertBoundedIdentifier`/`assertWritesEnabled`/`consumeRateLimit`), `convex/profanity.ts` (`containsProfanity`).

---

## Task 1: Outline region data and pure geometry helpers

**Files:**
- Create: `lib/sketchbookOutline.ts`
- Test: `lib/sketchbookOutline.test.ts`

**Interfaces:**
- Produces: `SketchbookRegion = { id: string; points: Point[] }`; `SKETCHBOOK_PAGE_WIDTH = 800`; `SKETCHBOOK_PAGE_HEIGHT = 1000`; `SKETCHBOOK_REGIONS: SketchbookRegion[]`; `isPointInRegion(region: SketchbookRegion, x: number, y: number): boolean`; `findRegionAt(regions: SketchbookRegion[], x: number, y: number): SketchbookRegion | null`; `regionPathData(region: SketchbookRegion): string`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/sketchbookOutline.test.ts
import { describe, it, expect } from "vitest";
import { SKETCHBOOK_REGIONS, findRegionAt, isPointInRegion, regionPathData } from "./sketchbookOutline";

describe("sketchbookOutline region hit-testing", () => {
  it("resolves a point inside the center region to 'center'", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 400, 400)?.id).toBe("center");
  });

  it("resolves a point inside petal-1 to 'petal-1'", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 400, 285)?.id).toBe("petal-1");
  });

  it("resolves a point inside the stem to 'stem'", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 400, 700)?.id).toBe("stem");
  });

  it("resolves points inside each leaf to their own region", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 330, 650)?.id).toBe("leaf-left");
    expect(findRegionAt(SKETCHBOOK_REGIONS, 470, 650)?.id).toBe("leaf-right");
  });

  it("returns null for a point outside every region", () => {
    expect(findRegionAt(SKETCHBOOK_REGIONS, 50, 50)).toBeNull();
    expect(findRegionAt(SKETCHBOOK_REGIONS, 700, 900)).toBeNull();
  });

  it("region ids are unique", () => {
    const ids = SKETCHBOOK_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds well-formed SVG/Path2D path data for every region", () => {
    for (const region of SKETCHBOOK_REGIONS) {
      const d = regionPathData(region);
      expect(d.startsWith("M ")).toBe(true);
      expect(d.endsWith("Z")).toBe(true);
    }
  });

  it("isPointInRegion agrees with findRegionAt for a known-inside point", () => {
    const center = SKETCHBOOK_REGIONS.find((r) => r.id === "center")!;
    expect(isPointInRegion(center, 400, 400)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sketchbookOutline.test.ts`
Expected: FAIL — `Cannot find module './sketchbookOutline'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/sketchbookOutline.ts
import type { Point } from "./types";

export type SketchbookRegion = { id: string; points: Point[] };

export const SKETCHBOOK_PAGE_WIDTH = 800;
export const SKETCHBOOK_PAGE_HEIGHT = 1000;

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number, sides = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

// v1 placeholder art: a simple 5-petal flower with a stem and two leaves.
// Every consumer (server validation, SVG render, canvas clip, hit test)
// reads only this array, so swapping in real outline art later only
// means editing this one list.
export const SKETCHBOOK_REGIONS: SketchbookRegion[] = [
  { id: "center", points: ellipsePolygon(400, 400, 50, 50) },
  { id: "petal-1", points: ellipsePolygon(400, 285, 55, 55) },
  { id: "petal-2", points: ellipsePolygon(509.4, 364.5, 55, 55) },
  { id: "petal-3", points: ellipsePolygon(467.6, 493, 55, 55) },
  { id: "petal-4", points: ellipsePolygon(332.4, 493, 55, 55) },
  { id: "petal-5", points: ellipsePolygon(290.6, 364.5, 55, 55) },
  {
    id: "stem",
    points: [
      { x: 390, y: 450 },
      { x: 410, y: 450 },
      { x: 410, y: 850 },
      { x: 390, y: 850 },
    ],
  },
  { id: "leaf-left", points: ellipsePolygon(330, 650, 50, 25) },
  { id: "leaf-right", points: ellipsePolygon(470, 650, 50, 25) },
];

/** Ray-casting point-in-polygon test — pure arithmetic, no DOM/canvas APIs,
 * so it runs identically in the browser and in Convex's server runtime. */
export function isPointInRegion(region: SketchbookRegion, x: number, y: number): boolean {
  const pts = region.points;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** First region (in array order) containing (x, y), or null if none does. */
export function findRegionAt(regions: SketchbookRegion[], x: number, y: number): SketchbookRegion | null {
  for (const region of regions) {
    if (isPointInRegion(region, x, y)) return region;
  }
  return null;
}

/** SVG/Path2D path-data string for a region's polygon, for `<path d=...>`
 * or `new Path2D(...)` — both browser-only call sites, never used here. */
export function regionPathData(region: SketchbookRegion): string {
  const [first, ...rest] = region.points;
  return `M ${first.x},${first.y} ${rest.map((p) => `L ${p.x},${p.y}`).join(" ")} Z`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/sketchbookOutline.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/sketchbookOutline.ts lib/sketchbookOutline.test.ts
git commit -m "feat: add sketchbook outline region data and hit-testing"
```

---

## Task 2: Convex schema and rate-limit constants

**Files:**
- Modify: `convex/schema.ts` (append two tables before the final `});`)
- Modify: `convex/constants.ts` (append two constants near the existing `STROKES_*` block)

**Interfaces:**
- Consumes: none.
- Produces: schema tables `sketchbookStrokes` (indexes `by_sequence`, `by_clientStrokeId`) and `sketchbookMetadata`; constants `SKETCHBOOK_STROKES_PER_CLIENT_WINDOW`, `SKETCHBOOK_STROKES_GLOBAL_WINDOW`.

- [ ] **Step 1: Add the two tables to the schema**

In `convex/schema.ts`, add before the closing `});` of `defineSchema`:

```ts
  sketchbookStrokes: defineTable({
    clientStrokeId: v.string(),
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    // Which SketchbookRegion (lib/sketchbookOutline.ts) this stroke is
    // clipped to — validated server-side against that same region list.
    regionId: v.string(),
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
    .index("by_clientStrokeId", ["clientStrokeId"]),

  sketchbookMetadata: defineTable({
    currentSequence: v.number(),
  }),
```

- [ ] **Step 2: Add the rate-limit constants**

In `convex/constants.ts`, add directly after the `STROKES_GLOBAL_WINDOW` line:

```ts
// Separate budget from the main canvas's strokes:* buckets, so heavy
// sketchbook use can't starve main-canvas writes or vice versa. Same
// values as STROKES_PER_CLIENT_WINDOW/STROKES_GLOBAL_WINDOW — sketchbook
// drawing uses the same StrokeBuffer flush cadence (~25 chunks/sec
// worst case), so the same headroom reasoning applies.
export const SKETCHBOOK_STROKES_PER_CLIENT_WINDOW = 300;
export const SKETCHBOOK_STROKES_GLOBAL_WINDOW = 2_000;
```

- [ ] **Step 3: Verify the schema and constants compile**

Run: `npx convex codegen` (or `npx tsc --noEmit` if `convex codegen` requires a running deployment)
Expected: no type errors; `convex/_generated/dataModel.d.ts` includes `sketchbookStrokes` and `sketchbookMetadata`.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/constants.ts
git commit -m "feat: add sketchbook Convex schema and rate-limit constants"
```

---

## Task 3: Sketchbook sequence counter

**Files:**
- Create: `convex/sketchbookMetadata.ts`

**Interfaces:**
- Consumes: `sketchbookMetadata` table (Task 2).
- Produces: `claimNextSequence(ctx: MutationCtx): Promise<number>`.

- [ ] **Step 1: Write the implementation**

```ts
// convex/sketchbookMetadata.ts
import type { MutationCtx } from "./_generated/server";

/** Claims the next sketchbook stroke sequence number — transactional
 * read-increment-write on the sketchbookMetadata singleton. Mirrors
 * convex/canvasMetadata.ts's claimNextSequence exactly, against its own
 * table, so the sketchbook's incremental sync never shares a sequence
 * space with the main canvas. */
export async function claimNextSequence(ctx: MutationCtx): Promise<number> {
  let metadata = await ctx.db.query("sketchbookMetadata").first();
  if (metadata === null) {
    const id = await ctx.db.insert("sketchbookMetadata", { currentSequence: 0 });
    metadata = await ctx.db.get(id);
    if (metadata === null) throw new Error("failed to create sketchbookMetadata");
  }
  const next = metadata.currentSequence + 1;
  await ctx.db.patch(metadata._id, { currentSequence: next });
  return next;
}
```

This has no dedicated test file, matching `convex/canvasMetadata.ts`'s own precedent — it's exercised indirectly through `sketchbookStrokes.submit` in Task 4.

- [ ] **Step 2: Commit**

```bash
git add convex/sketchbookMetadata.ts
git commit -m "feat: add sketchbook sequence counter"
```

---

## Task 4: Sketchbook strokes submit/listSince

**Files:**
- Create: `convex/sketchbookStrokes.ts`
- Test: `convex/sketchbookStrokes.test.ts`

**Interfaces:**
- Consumes: `SKETCHBOOK_REGIONS`, `SKETCHBOOK_PAGE_WIDTH`, `SKETCHBOOK_PAGE_HEIGHT` (Task 1); `claimNextSequence` (Task 3); `assertBoundedIdentifier`/`assertWritesEnabled`/`consumeRateLimit` (`convex/abuse.ts`); `containsProfanity` (`convex/profanity.ts`); `SKETCHBOOK_STROKES_PER_CLIENT_WINDOW`/`SKETCHBOOK_STROKES_GLOBAL_WINDOW` (Task 2).
- Produces: `api.sketchbookStrokes.submit(args): { sequence: number }`; `api.sketchbookStrokes.listSince({ afterSequence, limit? }): ServerStroke[]` where each row has `{ _id, _creationTime, clientStrokeId, clientId, username?, countryCode?, mode, regionId, color, width, opacity?, points, clientTimestamp, sequence, serverTimestamp, deleted? }`.

- [ ] **Step 1: Write the failing tests**

```ts
// convex/sketchbookStrokes.test.ts
// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH, SKETCHBOOK_STROKES_PER_CLIENT_WINDOW } from "./constants";
import { SKETCHBOOK_PAGE_WIDTH, SKETCHBOOK_PAGE_HEIGHT } from "../lib/sketchbookOutline";
import type { StrokeMode, Point } from "../lib/types";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseArgs = {
  clientId: "anon-tester",
  mode: "draw" as StrokeMode,
  regionId: "center",
  color: "#e0432b",
  width: 8,
  opacity: 1,
  points: [{ x: 400, y: 400 }] as Point[],
  clientTimestamp: 0,
};

function strokeArgs(overrides: Partial<typeof baseArgs> & { clientStrokeId: string }) {
  return { ...baseArgs, ...overrides };
}

describe("sketchbookStrokes.submit — validation boundaries", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("accepts a valid stroke and returns a sequence", async () => {
    const result = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "ok-1" }));
    expect(result.sequence).toBeGreaterThan(0);
  });

  it("rejects an unknown regionId", async () => {
    await expect(
      t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({ clientStrokeId: "bad-region", regionId: "not-a-region" }),
      ),
    ).rejects.toThrow();
  });

  it("rejects width below the minimum, accepts width at the minimum", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "w-lo", width: MIN_BRUSH_WIDTH - 1 })),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "w-ok", width: MIN_BRUSH_WIDTH })),
    ).resolves.toBeDefined();
  });

  it("rejects width above the maximum", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "w-hi", width: MAX_BRUSH_WIDTH + 1 })),
    ).rejects.toThrow();
  });

  it("rejects coordinates outside the page bounds", async () => {
    await expect(
      t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({
          clientStrokeId: "oob",
          points: [{ x: SKETCHBOOK_PAGE_WIDTH + 1, y: SKETCHBOOK_PAGE_HEIGHT }],
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects a malformed color", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "c-bad", color: "not-a-color" })),
    ).rejects.toThrow();
  });

  it("rate limits excessive chunks from one anonymous client", async () => {
    for (let i = 0; i < SKETCHBOOK_STROKES_PER_CLIENT_WINDOW; i++) {
      await t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({ clientStrokeId: `rate-${i}`, clientId: "rate-client" }),
      );
    }
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "rate-over", clientId: "rate-client" })),
    ).rejects.toThrow(/rate limit/);
  });
});

describe("sketchbookStrokes.submit — idempotency and sequencing", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns the same sequence and inserts only once on a retried clientStrokeId", async () => {
    const first = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "dup-1" }));
    const second = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "dup-1" }));
    expect(second.sequence).toBe(first.sequence);

    const rows = await t.query(api.sketchbookStrokes.listSince, { afterSequence: 0 });
    expect(rows.filter((r) => r.clientStrokeId === "dup-1")).toHaveLength(1);
  });
});

describe("sketchbookStrokes.listSince", () => {
  let t: ReturnType<typeof convexTest>;
  beforeEach(() => {
    t = convexTest(schema, modules);
  });

  it("returns only strokes after the given sequence", async () => {
    const first = await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "seq-1" }));
    await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "seq-2" }));
    const rows = await t.query(api.sketchbookStrokes.listSince, { afterSequence: first.sequence });
    expect(rows.map((r) => r.clientStrokeId)).toEqual(["seq-2"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/sketchbookStrokes.test.ts`
Expected: FAIL — `Cannot find module './sketchbookStrokes'`

- [ ] **Step 3: Write the implementation**

```ts
// convex/sketchbookStrokes.ts
import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  MIN_BRUSH_WIDTH,
  MAX_BRUSH_WIDTH,
  MIN_OPACITY,
  MAX_OPACITY,
  MIN_POINTS_PER_STROKE,
  MAX_POINTS_PER_STROKE,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  COLOR_PATTERN,
  MAX_CLIENT_ID_LENGTH,
  MAX_CLIENT_STROKE_ID_LENGTH,
  MAX_COLOR_LENGTH,
  MAX_USERNAME_LENGTH,
  COUNTRY_CODE_PATTERN,
  RATE_LIMIT_WINDOW_MS,
  SKETCHBOOK_STROKES_PER_CLIENT_WINDOW,
  SKETCHBOOK_STROKES_GLOBAL_WINDOW,
} from "./constants";
import { assertBoundedIdentifier, assertWritesEnabled, consumeRateLimit } from "./abuse";
import { containsProfanity } from "./profanity";
import { claimNextSequence } from "./sketchbookMetadata";
import { SKETCHBOOK_PAGE_WIDTH, SKETCHBOOK_PAGE_HEIGHT, SKETCHBOOK_REGIONS } from "../lib/sketchbookOutline";

const pointValidator = v.object({ x: v.number(), y: v.number() });
const SKETCHBOOK_REGION_IDS = new Set(SKETCHBOOK_REGIONS.map((r) => r.id));

const sketchbookStrokeReturnFields = v.object({
  _id: v.id("sketchbookStrokes"),
  _creationTime: v.number(),
  clientStrokeId: v.string(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  mode: v.union(v.literal("draw"), v.literal("erase")),
  regionId: v.string(),
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
    regionId: v.string(),
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
    if (!SKETCHBOOK_REGION_IDS.has(args.regionId)) {
      throw new Error(`unknown regionId: ${args.regionId}`);
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
      if (p.x < 0 || p.x > SKETCHBOOK_PAGE_WIDTH || p.y < 0 || p.y > SKETCHBOOK_PAGE_HEIGHT) {
        throw new Error(
          `point coordinates must be within [0, ${SKETCHBOOK_PAGE_WIDTH}] x [0, ${SKETCHBOOK_PAGE_HEIGHT}]`,
        );
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
      .query("sketchbookStrokes")
      .withIndex("by_clientStrokeId", (q) => q.eq("clientStrokeId", args.clientStrokeId))
      .unique();
    if (existing !== null) {
      return { sequence: existing.sequence };
    }

    await consumeRateLimit(
      ctx,
      `sketchbookStrokes:client:${args.clientId}`,
      SKETCHBOOK_STROKES_PER_CLIENT_WINDOW,
      RATE_LIMIT_WINDOW_MS,
    );
    await consumeRateLimit(ctx, "sketchbookStrokes:global", SKETCHBOOK_STROKES_GLOBAL_WINDOW, RATE_LIMIT_WINDOW_MS);

    const nextSequence = await claimNextSequence(ctx);

    await ctx.db.insert("sketchbookStrokes", {
      clientStrokeId: args.clientStrokeId,
      clientId: args.clientId,
      username: args.username,
      countryCode: args.countryCode,
      mode: args.mode,
      regionId: args.regionId,
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
  returns: v.array(sketchbookStrokeReturnFields),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT);
    const rows = await ctx.db
      .query("sketchbookStrokes")
      .withIndex("by_sequence", (q) => q.gt("sequence", args.afterSequence))
      .order("asc")
      .take(limit);
    return rows;
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/sketchbookStrokes.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/sketchbookStrokes.ts convex/sketchbookStrokes.test.ts
git commit -m "feat: add sketchbook strokes submit/listSince Convex functions"
```

---

## Task 5: SketchbookCanvas component

**Files:**
- Create: `components/SketchbookCanvas.tsx`

**Interfaces:**
- Consumes: `api.sketchbookStrokes.submit`/`listSince` (Task 4); `SKETCHBOOK_PAGE_WIDTH`/`SKETCHBOOK_PAGE_HEIGHT`/`SKETCHBOOK_REGIONS`/`findRegionAt`/`regionPathData` (Task 1); `drawStroke`/`drawSegment` (`lib/drawing.ts`); `screenToWorld`/`worldToScreen` (`lib/coordinates.ts`); `StrokeBuffer` (`lib/strokeBuffer.ts`); `getClientId`/`getUsername`/`getCachedCountryCode` (`lib/identity.ts`); `PALETTE_PRESETS` (`lib/palettes.ts`); `MIN_BRUSH_WIDTH`/`MAX_BRUSH_WIDTH` (`convex/constants.ts`).
- Produces: `export function SketchbookCanvas(): JSX.Element` — consumed by Task 6's route.

- [ ] **Step 1: Write the component**

```tsx
// components/SketchbookCanvas.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH } from "@/convex/constants";
import type { StrokeMode, Point } from "@/lib/types";
import { getClientId, getUsername, getCachedCountryCode } from "@/lib/identity";
import { drawStroke, drawSegment } from "@/lib/drawing";
import { screenToWorld, worldToScreen } from "@/lib/coordinates";
import type { Camera } from "@/lib/camera";
import { StrokeBuffer } from "@/lib/strokeBuffer";
import { PALETTE_PRESETS } from "@/lib/palettes";
import {
  SKETCHBOOK_PAGE_WIDTH,
  SKETCHBOOK_PAGE_HEIGHT,
  SKETCHBOOK_REGIONS,
  findRegionAt,
  regionPathData,
  type SketchbookRegion,
} from "@/lib/sketchbookOutline";

const DEFAULT_WIDTH = 16;
const DEFAULT_COLOR = PALETTE_PRESETS[0].colors[2];

type SketchbookStroke = {
  clientStrokeId: string;
  sequence: number;
  mode: StrokeMode;
  regionId: string;
  color: string;
  width: number;
  opacity?: number;
  points: Point[];
};

export function SketchbookCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cameraRef = useRef<Camera>({ x: SKETCHBOOK_PAGE_WIDTH / 2, y: SKETCHBOOK_PAGE_HEIGHT / 2, zoom: 1 });
  const viewportRef = useRef({ width: 0, height: 0 });
  const regionPathsRef = useRef<Map<string, Path2D>>(new Map());

  const [tool, setTool] = useState<StrokeMode>("draw");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [afterSequence, setAfterSequence] = useState(0);

  const clientIdRef = useRef(getClientId());
  const usernameRef = useRef(getUsername());
  const countryCodeRef = useRef(getCachedCountryCode());

  // ponytail: replay (after a resize) draws strokes in arrival order, not
  // true server sequence — own in-flight strokes are appended before their
  // server sequence is known. Fine for a coloring page (draw/erase order
  // rarely matters visually); revisit with sequence-sorted replay if
  // resize artifacts become noticeable in practice.
  const allStrokesRef = useRef<SketchbookStroke[]>([]);
  const renderedIdsRef = useRef<Set<string>>(new Set());
  const activeRegionRef = useRef<SketchbookRegion | null>(null);
  const bufferRef = useRef<StrokeBuffer | null>(null);
  const lastWorldPointRef = useRef<Point | null>(null);

  const submitStroke = useMutation(api.sketchbookStrokes.submit);
  const liveTail = useQuery(api.sketchbookStrokes.listSince, { afterSequence });

  const drawStrokeClipped = useCallback((stroke: SketchbookStroke) => {
    const ctx = ctxRef.current;
    const path2d = regionPathsRef.current.get(stroke.regionId);
    if (!ctx || !path2d) return;
    const { width: vw, height: vh } = viewportRef.current;
    ctx.save();
    ctx.clip(path2d);
    drawStroke(ctx, cameraRef.current, vw, vh, stroke.points, stroke.mode, stroke.color, stroke.width);
    ctx.restore();
  }, []);

  const replayAll = useCallback(() => {
    for (const stroke of allStrokesRef.current) {
      drawStrokeClipped(stroke);
    }
  }, [drawStrokeClipped]);

  // Resize: track viewport size, scale the canvas backing store to
  // devicePixelRatio, fit the fixed page to the viewport, rebuild each
  // region's clip Path2D in that screen space, and replay history — both
  // resizing the canvas element and a camera change invalidate what was
  // there before (a canvas resize clears its bitmap; a stale Path2D would
  // clip against the old scale).
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      viewportRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;

      const zoom = Math.min(rect.width / SKETCHBOOK_PAGE_WIDTH, rect.height / SKETCHBOOK_PAGE_HEIGHT);
      cameraRef.current = { x: SKETCHBOOK_PAGE_WIDTH / 2, y: SKETCHBOOK_PAGE_HEIGHT / 2, zoom };

      const paths = new Map<string, Path2D>();
      for (const region of SKETCHBOOK_REGIONS) {
        const screenPts = region.points.map((p) => worldToScreen(p.x, p.y, cameraRef.current, rect.width, rect.height));
        paths.set(region.id, new Path2D(regionPathData({ id: region.id, points: screenPts })));
      }
      regionPathsRef.current = paths;

      replayAll();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [replayAll]);

  // Apply newly synced strokes as they arrive.
  useEffect(() => {
    if (!liveTail || liveTail.length === 0) return;
    let maxSeq = afterSequence;
    for (const row of liveTail) {
      maxSeq = Math.max(maxSeq, row.sequence);
      if (renderedIdsRef.current.has(row.clientStrokeId)) continue;
      renderedIdsRef.current.add(row.clientStrokeId);
      allStrokesRef.current.push(row);
      drawStrokeClipped(row);
    }
    setAfterSequence(maxSeq);
  }, [liveTail, afterSequence, drawStrokeClipped]);

  const commitChunk = useCallback(
    (
      points: Point[],
      mode: StrokeMode,
      regionId: string,
      chunkColor: string,
      chunkWidth: number,
      clientStrokeId: string,
    ) => {
      const stroke: SketchbookStroke = {
        clientStrokeId,
        sequence: -1,
        mode,
        regionId,
        color: chunkColor,
        width: chunkWidth,
        opacity: 1,
        points,
      };
      renderedIdsRef.current.add(clientStrokeId);
      allStrokesRef.current.push(stroke);
      submitStroke({
        clientStrokeId,
        clientId: clientIdRef.current,
        username: usernameRef.current,
        countryCode: countryCodeRef.current,
        mode,
        regionId,
        color: chunkColor,
        width: chunkWidth,
        opacity: 1,
        points,
        clientTimestamp: Date.now(),
      }).catch((err) => {
        console.error("sketchbook stroke submit rejected", err);
        setErrorMessage("a mark didn't stick — try again");
      });
    },
    [submitStroke],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPt = screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height);
      const region = findRegionAt(SKETCHBOOK_REGIONS, worldPt.x, worldPt.y);
      if (!region) return;

      canvas.setPointerCapture(e.pointerId);
      activeRegionRef.current = region;
      lastWorldPointRef.current = worldPt;

      const regionId = region.id;
      const mode = tool;
      const chunkColor = color;
      const chunkWidth = width;
      bufferRef.current = new StrokeBuffer(
        clientIdRef.current,
        mode,
        undefined,
        chunkColor,
        chunkWidth,
        1,
        usernameRef.current,
        countryCodeRef.current,
        (chunk) => commitChunk(chunk.points, mode, regionId, chunkColor, chunkWidth, chunk.clientStrokeId),
      );
      bufferRef.current.addPoint(worldPt);

      const ctx = ctxRef.current;
      const path2d = regionPathsRef.current.get(regionId);
      if (ctx && path2d) {
        ctx.save();
        ctx.clip(path2d);
        drawStroke(ctx, cameraRef.current, viewportRef.current.width, viewportRef.current.height, [worldPt], mode, chunkColor, chunkWidth);
        ctx.restore();
      }
    },
    [tool, color, width, commitChunk],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const buffer = bufferRef.current;
    const region = activeRegionRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!buffer || !region || !canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPt = screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height);

    const from = lastWorldPointRef.current ?? worldPt;
    const path2d = regionPathsRef.current.get(region.id);
    if (path2d) {
      ctx.save();
      ctx.clip(path2d);
      drawSegment(ctx, cameraRef.current, viewportRef.current.width, viewportRef.current.height, from, worldPt, buffer.mode, buffer.color, buffer.width);
      ctx.restore();
    }
    lastWorldPointRef.current = worldPt;
    buffer.addPoint(worldPt);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    bufferRef.current?.finish();
    bufferRef.current = null;
    activeRegionRef.current = null;
    lastWorldPointRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }, []);

  const outlinePaths = useMemo(
    () => SKETCHBOOK_REGIONS.map((region) => ({ id: region.id, d: regionPathData(region) })),
    [],
  );

  return (
    <div ref={containerRef} className="relative h-dvh w-full overflow-hidden bg-[#f0ebd9]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${SKETCHBOOK_PAGE_WIDTH} ${SKETCHBOOK_PAGE_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {outlinePaths.map((p) => (
          <path key={p.id} d={p.d} fill="none" stroke="#1a1a1a" strokeWidth={3} strokeLinejoin="round" />
        ))}
      </svg>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/90 px-4 py-2 shadow-lg">
        {PALETTE_PRESETS[0].colors.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`color ${swatch}`}
            onClick={() => {
              setColor(swatch);
              setTool("draw");
            }}
            className="h-7 w-7 rounded-full border-2"
            style={{ backgroundColor: swatch, borderColor: color === swatch && tool === "draw" ? "#1a1a1a" : "transparent" }}
          />
        ))}
        <input
          type="range"
          min={MIN_BRUSH_WIDTH}
          max={MAX_BRUSH_WIDTH}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-24"
        />
        <button
          type="button"
          onClick={() => setTool((t) => (t === "erase" ? "draw" : "erase"))}
          className={`rounded-full px-3 py-1 text-sm font-medium ${tool === "erase" ? "bg-[#1a1a1a] text-white" : "bg-black/10"}`}
        >
          Eraser
        </button>
      </div>
      {errorMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-sm text-white">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors involving `SketchbookCanvas.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/SketchbookCanvas.tsx
git commit -m "feat: add SketchbookCanvas component"
```

---

## Task 6: `/sketchbook` route and end-to-end verification

**Files:**
- Create: `app/sketchbook/page.tsx`

**Interfaces:**
- Consumes: `SketchbookCanvas` (Task 5).
- Produces: the `/sketchbook` route.

- [ ] **Step 1: Write the route**

```tsx
// app/sketchbook/page.tsx
"use client";

import dynamic from "next/dynamic";

// Skip SSR, same reason as app/canvas/page.tsx: avoid hydrating against
// browser-only state (canvas/localStorage-backed identity).
const SketchbookCanvas = dynamic(
  () => import("@/components/SketchbookCanvas").then((m) => m.SketchbookCanvas),
  { ssr: false },
);

export default function SketchbookPage() {
  return <SketchbookCanvas />;
}
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `lib/sketchbookOutline.test.ts` and `convex/sketchbookStrokes.test.ts`.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, then open `http://localhost:3000/sketchbook` in two browser tabs side by side.

Verify:
- The flower outline (petals, center, stem, two leaves) renders and stays sharp — it never gets paint on it.
- Selecting a color and dragging inside a petal paints only inside that petal; dragging past its edge does not leak paint outside the outline.
- Dragging starting outside every region (e.g. the blank page background) does nothing.
- A stroke painted in one tab appears in the other tab within roughly a second.
- Toggling "Eraser" and dragging over previously painted color inside a region erases only that paint, never the outline.
- Resizing the browser window keeps the flower and all painted strokes visible, correctly scaled, and does not shift them out of alignment with the outline.

- [ ] **Step 4: Commit**

```bash
git add app/sketchbook/page.tsx
git commit -m "feat: add /sketchbook route"
```

---

## Self-Review Notes

- **Spec coverage:** Route & component (Task 5/6), outline-lock mechanic (Task 1 + Task 5's clip logic), coordinates & scale-to-fit (Task 5's resize handler), drawing/rendering reuse (Task 5 imports), data model (Task 2), sketchbookMetadata/sketchbookStrokes (Tasks 3–4), client sync (Task 5's `liveTail` effect), error handling (Task 5's `catch` + Task 4's validation), testing (Task 1 and Task 4's test files) — all covered.
- **Placeholder scan:** none found; every step has runnable code.
- **Type consistency:** `SketchbookStroke` (component) matches the shape of rows returned by `sketchbookStrokeReturnFields` (Task 4) on every field the component reads (`clientStrokeId`, `sequence`, `mode`, `regionId`, `color`, `width`, `opacity`, `points`); `StrokeBuffer`'s constructor argument order and public fields (`mode`, `color`, `width`) match Task 5's usage; `findRegionAt`/`regionPathData`/`SketchbookRegion` signatures match between Task 1's definition and Task 5's usage.
