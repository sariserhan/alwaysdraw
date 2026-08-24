# Multi-Page Sketchbook Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/sketchbook` from one hardcoded flower into a gallery of pages — each an independent shared/live coloring canvas — so new outline art can be added by editing one registry, not by redoing the architecture.

**Architecture:** `lib/sketchbookOutline.ts` (one outline) becomes `lib/sketchbookPages.ts` (a `Record<pageId, SketchbookPage>` registry — this plan ships two: the existing flower and one new minimal circle). `convex/sketchbookStrokes.ts` gains a `pageId` field and a compound `by_pageId_and_sequence` index so each page's strokes are fully isolated. `components/SketchbookCanvas.tsx` takes a `pageId` prop instead of reading module-level constants. Routing splits into a static gallery (`/sketchbook`) and a per-page canvas (`/sketchbook/[pageId]`).

**Tech Stack:** Next.js (App Router), Convex, `convex-test` + Vitest, Tailwind v4, Canvas 2D API.

**Spec:** `docs/superpowers/specs/2026-08-24-sketchbook-multi-page-design.md`

## Global Constraints

- No new npm dependencies.
- No DOM APIs (`Path2D`, canvas contexts) in `lib/sketchbookPages.ts` or any `convex/*.ts` file — this repo's test setup has no jsdom/`canvas` polyfill.
- `SKETCHBOOK_PAGES` in `lib/sketchbookPages.ts` is the single source of truth for page/region ids and dimensions — Convex imports it directly, never a mirrored copy.
- The sequence counter (`convex/sketchbookMetadata.ts`) and rate-limit budget (`SKETCHBOOK_STROKES_PER_CLIENT_WINDOW`/`_GLOBAL_WINDOW`) stay shared across all pages — do not fragment either per page.
- The backfill migration (`convex/migrations.ts`) is written by this plan but is a manual, one-time, user-triggered operation — no task or test invokes it automatically.
- Reuse existing helpers as-is: `lib/drawing.ts`, `lib/strokeBuffer.ts`, `lib/identity.ts`, `lib/coordinates.ts`, `lib/palettes.ts`, `convex/abuse.ts`, `convex/profanity.ts` — only the sketchbook-specific files listed below change.

---

## Task 1: Page registry — `lib/sketchbookOutline.ts` → `lib/sketchbookPages.ts`

**Files:**
- Delete: `lib/sketchbookOutline.ts`, `lib/sketchbookOutline.test.ts`
- Create: `lib/sketchbookPages.ts`, `lib/sketchbookPages.test.ts`

**Interfaces:**
- Produces: `SketchbookRegion = { id: string; points: Point[] }`; `SketchbookPage = { id: string; title: string; width: number; height: number; regions: SketchbookRegion[] }`; `SKETCHBOOK_PAGES: Record<string, SketchbookPage>` (keys: `"flower"`, `"circle"`); `DEFAULT_SKETCHBOOK_PAGE_ID = "flower"`; `isPointInRegion(region, x, y): boolean`; `findRegionAt(regions, x, y): SketchbookRegion | null`; `regionPathData(region): string`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/sketchbookPages.test.ts
import { describe, it, expect } from "vitest";
import { SKETCHBOOK_PAGES, findRegionAt, isPointInRegion, regionPathData } from "./sketchbookPages";

describe("sketchbookPages region hit-testing — flower", () => {
  const regions = SKETCHBOOK_PAGES.flower.regions;

  it("resolves a point inside the center region to 'center'", () => {
    expect(findRegionAt(regions, 400, 400)?.id).toBe("center");
  });

  it("resolves a point inside petal-1 to 'petal-1'", () => {
    expect(findRegionAt(regions, 400, 285)?.id).toBe("petal-1");
  });

  it("resolves a point inside the stem to 'stem'", () => {
    expect(findRegionAt(regions, 400, 700)?.id).toBe("stem");
  });

  it("resolves points inside each leaf to their own region", () => {
    expect(findRegionAt(regions, 330, 650)?.id).toBe("leaf-left");
    expect(findRegionAt(regions, 470, 650)?.id).toBe("leaf-right");
  });

  it("returns null for a point outside every region", () => {
    expect(findRegionAt(regions, 50, 50)).toBeNull();
    expect(findRegionAt(regions, 700, 900)).toBeNull();
  });
});

describe("sketchbookPages region hit-testing — circle", () => {
  const regions = SKETCHBOOK_PAGES.circle.regions;

  it("resolves the page center to 'circle'", () => {
    expect(findRegionAt(regions, 200, 200)?.id).toBe("circle");
  });

  it("returns null for a point outside the circle", () => {
    expect(findRegionAt(regions, 10, 10)).toBeNull();
  });
});

describe("sketchbookPages registry invariants", () => {
  it("every page has unique region ids within that page", () => {
    for (const page of Object.values(SKETCHBOOK_PAGES)) {
      const ids = page.regions.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("builds well-formed SVG/Path2D path data for every region on every page", () => {
    for (const page of Object.values(SKETCHBOOK_PAGES)) {
      for (const region of page.regions) {
        const d = regionPathData(region);
        expect(d.startsWith("M ")).toBe(true);
        expect(d.endsWith("Z")).toBe(true);
      }
    }
  });

  it("isPointInRegion agrees with findRegionAt for a known-inside point", () => {
    const center = SKETCHBOOK_PAGES.flower.regions.find((r) => r.id === "center")!;
    expect(isPointInRegion(center, 400, 400)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/sketchbookPages.test.ts`
Expected: FAIL — `Cannot find module './sketchbookPages'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/sketchbookPages.ts
import type { Point } from "./types";

export type SketchbookRegion = { id: string; points: Point[] };

export type SketchbookPage = {
  id: string;
  title: string;
  width: number;
  height: number;
  regions: SketchbookRegion[];
};

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number, sides = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return pts;
}

// v1 placeholder art: a simple 5-petal flower with a stem and two leaves,
// plus a minimal one-region circle proving a second page works end to end.
// Every consumer (server validation, SVG render, canvas clip, hit test)
// reads only this registry, so adding real outline art later only means
// adding another entry here.
export const SKETCHBOOK_PAGES: Record<string, SketchbookPage> = {
  flower: {
    id: "flower",
    title: "Flower",
    width: 800,
    height: 1000,
    regions: [
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
    ],
  },
  circle: {
    id: "circle",
    title: "Circle",
    width: 400,
    height: 400,
    regions: [{ id: "circle", points: ellipsePolygon(200, 200, 150, 150) }],
  },
};

// Legacy sketchbookStrokes rows written before multi-page support have no
// pageId — the one-time backfill migration (convex/migrations.ts) assigns
// them here, since this was the only page that existed at the time.
export const DEFAULT_SKETCHBOOK_PAGE_ID = "flower";

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

- [ ] **Step 4: Delete the old files and run the test**

```bash
rm lib/sketchbookOutline.ts lib/sketchbookOutline.test.ts
npx vitest run lib/sketchbookPages.test.ts
```

Expected: PASS (9 tests). Note: `lib/sketchbookOutline.ts` still has other importers at this point in the plan (`convex/sketchbookStrokes.ts`, `components/SketchbookCanvas.tsx`) — the repo will not type-check again until Task 3 and Task 4 update those imports. That's expected mid-plan breakage; do not "fix" those files in this task.

- [ ] **Step 5: Commit**

```bash
git add lib/sketchbookPages.ts lib/sketchbookPages.test.ts
git rm lib/sketchbookOutline.ts lib/sketchbookOutline.test.ts
git commit -m "feat: replace single sketchbook outline with a page registry"
```

---

## Task 2: Convex schema + backfill migration

**Files:**
- Modify: `convex/schema.ts` (add `pageId` field and `by_pageId_and_sequence` index to `sketchbookStrokes`)
- Create: `convex/migrations.ts`

**Interfaces:**
- Consumes: `DEFAULT_SKETCHBOOK_PAGE_ID` (Task 1, `lib/sketchbookPages.ts`).
- Produces: `sketchbookStrokes.pageId: v.optional(v.string())`; index `by_pageId_and_sequence` on `["pageId", "sequence"]`; `internalMutation backfillSketchbookPageId`.

- [ ] **Step 1: Add `pageId` and the compound index to the schema**

In `convex/schema.ts`, modify the existing `sketchbookStrokes` table definition:

```ts
  sketchbookStrokes: defineTable({
    clientStrokeId: v.string(),
    clientId: v.string(),
    username: v.optional(v.string()),
    countryCode: v.optional(v.string()),
    mode: v.union(v.literal("draw"), v.literal("erase")),
    // Which SketchbookPage (lib/sketchbookPages.ts) this stroke belongs
    // to. Optional for backward compatibility with rows written before
    // multi-page support — see convex/migrations.ts's one-time backfill.
    pageId: v.optional(v.string()),
    // Which region within that page this stroke is clipped to —
    // validated server-side against that page's own region list.
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
    .index("by_clientStrokeId", ["clientStrokeId"])
    .index("by_pageId_and_sequence", ["pageId", "sequence"]),
```

Leave `sketchbookMetadata` unchanged.

- [ ] **Step 2: Write the migration**

```ts
// convex/migrations.ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_SKETCHBOOK_PAGE_ID } from "../lib/sketchbookPages";

// One-time, manually-run backfill for sketchbookStrokes rows written
// before multi-page support existed (no pageId field). Run once via
// `npx convex run migrations:backfillSketchbookPageId` after deploying
// the multi-page sketchbook — not invoked automatically by any app code
// or test. Idempotent: rows that already have a pageId are left alone,
// so it's safe to run more than once.
export const backfillSketchbookPageId = internalMutation({
  args: {},
  returns: v.object({ patched: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("sketchbookStrokes")
      .filter((q) => q.eq(q.field("pageId"), undefined))
      .collect();
    for (const row of rows) {
      await ctx.db.patch(row._id, { pageId: DEFAULT_SKETCHBOOK_PAGE_ID });
    }
    return { patched: rows.length };
  },
});
```

- [ ] **Step 3: Verify the schema and migration compile**

Run: `npx tsc --noEmit`
Expected: no type errors. (If you have a live Convex dev deployment available, `npx convex dev --once` will also confirm the schema push succeeds and register `migrations` in `convex/_generated/api.d.ts`; if not, hand-add the `migrations` module entry to `convex/_generated/api.d.ts` the same way `sketchbookMetadata`/`sketchbookStrokes` were added previously — import line plus map entry, alphabetically placed — so `api.migrations.backfillSketchbookPageId` type-checks.)

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/migrations.ts convex/_generated/api.d.ts
git commit -m "feat: add pageId to sketchbookStrokes schema and a backfill migration"
```

---

## Task 3: Per-page `sketchbookStrokes` submit/listSince

**Files:**
- Modify: `convex/sketchbookStrokes.ts`
- Modify: `convex/sketchbookStrokes.test.ts`

**Interfaces:**
- Consumes: `SKETCHBOOK_PAGES` (Task 1); `pageId`/`by_pageId_and_sequence` index (Task 2); `claimNextSequence` (`convex/sketchbookMetadata.ts`, unchanged).
- Produces: `api.sketchbookStrokes.submit(args)` — args now include required `pageId: string`, `regionId` validated against that page's regions, point bounds checked against that page's `width`/`height`; `api.sketchbookStrokes.listSince({ pageId, afterSequence, limit? })` — rows scoped to `pageId` via the compound index.

- [ ] **Step 1: Update the test file first (TDD against the new pageId-scoped behavior)**

```ts
// convex/sketchbookStrokes.test.ts
// @vitest-environment edge-runtime
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import { MIN_BRUSH_WIDTH, MAX_BRUSH_WIDTH, SKETCHBOOK_STROKES_PER_CLIENT_WINDOW } from "./constants";
import { SKETCHBOOK_PAGES } from "../lib/sketchbookPages";
import type { StrokeMode, Point } from "../lib/types";

const allModules = import.meta.glob("./**/*.*s");
const modules = Object.fromEntries(
  Object.entries(allModules).filter(([path]) => !path.endsWith(".test.ts")),
);

const baseArgs = {
  clientId: "anon-tester",
  mode: "draw" as StrokeMode,
  pageId: "flower",
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

  it("rejects an unknown pageId", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "bad-page", pageId: "not-a-page" })),
    ).rejects.toThrow();
  });

  it("rejects an unknown regionId", async () => {
    await expect(
      t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "bad-region", regionId: "not-a-region" })),
    ).rejects.toThrow();
  });

  it("rejects a regionId that belongs to a different page", async () => {
    await expect(
      t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({ clientStrokeId: "cross-page-region", pageId: "circle", regionId: "petal-1" }),
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
    const { width, height } = SKETCHBOOK_PAGES.flower;
    await expect(
      t.mutation(
        api.sketchbookStrokes.submit,
        strokeArgs({ clientStrokeId: "oob", points: [{ x: width + 1, y: height }] }),
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

    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "flower", afterSequence: 0 });
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
    const rows = await t.query(api.sketchbookStrokes.listSince, { pageId: "flower", afterSequence: first.sequence });
    expect(rows.map((r) => r.clientStrokeId)).toEqual(["seq-2"]);
  });

  it("rejects an unknown pageId", async () => {
    await expect(
      t.query(api.sketchbookStrokes.listSince, { pageId: "not-a-page", afterSequence: 0 }),
    ).rejects.toThrow();
  });

  it("never returns strokes submitted under a different pageId", async () => {
    await t.mutation(api.sketchbookStrokes.submit, strokeArgs({ clientStrokeId: "flower-1" }));
    await t.mutation(
      api.sketchbookStrokes.submit,
      strokeArgs({ clientStrokeId: "circle-1", pageId: "circle", regionId: "circle" }),
    );

    const flowerRows = await t.query(api.sketchbookStrokes.listSince, { pageId: "flower", afterSequence: 0 });
    const circleRows = await t.query(api.sketchbookStrokes.listSince, { pageId: "circle", afterSequence: 0 });

    expect(flowerRows.map((r) => r.clientStrokeId)).toEqual(["flower-1"]);
    expect(circleRows.map((r) => r.clientStrokeId)).toEqual(["circle-1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/sketchbookStrokes.test.ts`
Expected: FAIL — `submit`/`listSince` reject `pageId` as an unexpected argument (old signature), or the cross-page/pageId-scoping assertions fail against the old single-region-list validation.

- [ ] **Step 3: Update the implementation**

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
import { SKETCHBOOK_PAGES } from "../lib/sketchbookPages";

const pointValidator = v.object({ x: v.number(), y: v.number() });

const sketchbookStrokeReturnFields = v.object({
  _id: v.id("sketchbookStrokes"),
  _creationTime: v.number(),
  clientStrokeId: v.string(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  mode: v.union(v.literal("draw"), v.literal("erase")),
  pageId: v.optional(v.string()),
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
    pageId: v.string(),
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

    const page = SKETCHBOOK_PAGES[args.pageId];
    if (!page) {
      throw new Error(`unknown pageId: ${args.pageId}`);
    }
    if (!page.regions.some((r) => r.id === args.regionId)) {
      throw new Error(`unknown regionId: ${args.regionId} for page ${args.pageId}`);
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
      if (p.x < 0 || p.x > page.width || p.y < 0 || p.y > page.height) {
        throw new Error(`point coordinates must be within [0, ${page.width}] x [0, ${page.height}]`);
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
      pageId: args.pageId,
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

// ponytail: no pruning/snapshot mechanism — every visitor replays the full
// per-page stroke history from afterSequence: 0, so this table grows
// unbounded forever. Fine while stroke counts stay in the thousands per
// page; upgrade path if it becomes a real problem is either a prune cron
// keeping only the newest N sequences per page, or a snapshot mechanism
// like the main canvas's snapshots.ts/GlobalCanvas.tsx's
// snapshots.getLatest seeding pattern.
export const listSince = query({
  args: {
    pageId: v.string(),
    afterSequence: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(sketchbookStrokeReturnFields),
  handler: async (ctx, args) => {
    if (!SKETCHBOOK_PAGES[args.pageId]) {
      throw new Error(`unknown pageId: ${args.pageId}`);
    }
    const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT), MAX_LIST_LIMIT);
    const rows = await ctx.db
      .query("sketchbookStrokes")
      .withIndex("by_pageId_and_sequence", (q) =>
        q.eq("pageId", args.pageId).gt("sequence", args.afterSequence),
      )
      .order("asc")
      .take(limit);
    return rows;
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/sketchbookStrokes.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add convex/sketchbookStrokes.ts convex/sketchbookStrokes.test.ts
git commit -m "feat: scope sketchbookStrokes submit/listSince by pageId"
```

---

## Task 4: `SketchbookCanvas` takes a `pageId` prop

**Files:**
- Modify: `components/SketchbookCanvas.tsx`

**Interfaces:**
- Consumes: `SKETCHBOOK_PAGES`, `findRegionAt`, `regionPathData`, `SketchbookRegion` (Task 1, from `@/lib/sketchbookPages` — import path changes from `@/lib/sketchbookOutline`); `api.sketchbookStrokes.submit`/`listSince` new `pageId`-bearing shape (Task 3).
- Produces: `export function SketchbookCanvas({ pageId }: { pageId: string }): JSX.Element` — consumed by Task 5's `[pageId]` route. The caller must guarantee `pageId` is a valid key in `SKETCHBOOK_PAGES` (the route does this via `notFound()`); this component does not itself guard against an unknown `pageId`.

- [ ] **Step 1: Replace the file with the pageId-aware version**

```tsx
// components/SketchbookCanvas.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
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
  SKETCHBOOK_PAGES,
  findRegionAt,
  regionPathData,
  type SketchbookRegion,
} from "@/lib/sketchbookPages";

const DEFAULT_WIDTH = 16;
const DEFAULT_COLOR = PALETTE_PRESETS[0].colors[2];

// ponytail: server rejects a whole chunk if any point falls outside the page
// rect, so clamp here (not lib/coordinates' clampToWorld — that's the main
// canvas's 20000x20000 world, wrong bounds for this fixed-size page).
function clampToPage(pt: Point, width: number, height: number): Point {
  return {
    x: Math.min(width, Math.max(0, pt.x)),
    y: Math.min(height, Math.max(0, pt.y)),
  };
}

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

export function SketchbookCanvas({ pageId }: { pageId: string }) {
  const page = SKETCHBOOK_PAGES[pageId];

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cameraRef = useRef<Camera>({ x: page.width / 2, y: page.height / 2, zoom: 1 });
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
  const liveTail = useQuery(api.sketchbookStrokes.listSince, { pageId, afterSequence });

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

      const zoom = Math.min(rect.width / page.width, rect.height / page.height);
      cameraRef.current = { x: page.width / 2, y: page.height / 2, zoom };

      const paths = new Map<string, Path2D>();
      for (const region of page.regions) {
        const screenPts = region.points.map((p) => worldToScreen(p.x, p.y, cameraRef.current, rect.width, rect.height));
        paths.set(region.id, new Path2D(regionPathData({ id: region.id, points: screenPts })));
      }
      regionPathsRef.current = paths;

      replayAll();
    };

    resize();
    // ponytail: rAF-debounce so a window-edge drag (many ResizeObserver
    // callbacks per second) only replays the full stroke history once per
    // frame instead of once per callback.
    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        resize();
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [replayAll, page]);

  useEffect(() => {
    if (!errorMessage) return;
    const id = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(id);
  }, [errorMessage]);

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
        pageId,
        regionId,
        color: chunkColor,
        width: chunkWidth,
        opacity: 1,
        points,
        clientTimestamp: Date.now(),
      }).catch((err) => {
        console.error("sketchbook stroke submit rejected", err);
        renderedIdsRef.current.delete(clientStrokeId);
        allStrokesRef.current = allStrokesRef.current.filter((s) => s.clientStrokeId !== clientStrokeId);
        const ctx = ctxRef.current;
        if (ctx) {
          const { width: vw, height: vh } = viewportRef.current;
          ctx.clearRect(0, 0, vw, vh);
          replayAll();
        }
        setErrorMessage(err instanceof ConvexError ? "drawing too fast — pace yourself a sec" : "a mark didn't stick — try again");
      });
    },
    [submitStroke, replayAll, pageId],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const rawWorldPt = screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height);
      const region = findRegionAt(page.regions, rawWorldPt.x, rawWorldPt.y);
      if (!region) return;

      const worldPt = clampToPage(rawWorldPt, page.width, page.height);

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
    [tool, color, width, commitChunk, page],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const buffer = bufferRef.current;
      const region = activeRegionRef.current;
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!buffer || !region || !canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldPt = clampToPage(
        screenToWorld(screenX, screenY, cameraRef.current, viewportRef.current.width, viewportRef.current.height),
        page.width,
        page.height,
      );

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
    },
    [page],
  );

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
    () => page.regions.map((region) => ({ id: region.id, d: regionPathData(region) })),
    [page],
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
        onPointerCancel={handlePointerUp}
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${page.width} ${page.height}`}
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
          aria-label="brush width"
          min={MIN_BRUSH_WIDTH}
          max={MAX_BRUSH_WIDTH}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-24"
        />
        <button
          type="button"
          aria-pressed={tool === "erase"}
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
Expected: no errors involving `SketchbookCanvas.tsx`. (`app/sketchbook/page.tsx` will still fail to type-check at this point — it calls `<SketchbookCanvas />` with no `pageId` prop — that's expected and gets fixed in Task 5.)

- [ ] **Step 3: Commit**

```bash
git add components/SketchbookCanvas.tsx
git commit -m "feat: parameterize SketchbookCanvas by pageId"
```

---

## Task 5: Gallery route, per-page route, sitemap

**Files:**
- Modify: `app/sketchbook/page.tsx` (becomes the gallery)
- Create: `app/sketchbook/[pageId]/page.tsx` (the per-page canvas route)
- Modify: `app/sitemap.ts`

**Interfaces:**
- Consumes: `SKETCHBOOK_PAGES`, `regionPathData` (Task 1); `SketchbookCanvas` (Task 4).
- Produces: `/sketchbook` (gallery), `/sketchbook/[pageId]` (canvas, 404s on an unknown id).

- [ ] **Step 1: Rewrite the gallery page**

```tsx
// app/sketchbook/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { SKETCHBOOK_PAGES, regionPathData } from "@/lib/sketchbookPages";

export const metadata: Metadata = {
  title: "Sketchbook — alwaysdraw",
  description: "Pick a page and color it together with everyone online, live.",
};

export default function SketchbookGalleryPage() {
  const pages = Object.values(SKETCHBOOK_PAGES);

  return (
    <div className="min-h-dvh bg-[#f0ebd9] px-6 py-12">
      <h1 className="mb-8 text-center text-3xl font-semibold text-[#1a1a1a]">Sketchbook</h1>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3">
        {pages.map((page) => (
          <Link
            key={page.id}
            href={`/sketchbook/${page.id}`}
            className="flex flex-col items-center gap-2 rounded-lg bg-white/60 p-4 transition hover:bg-white"
          >
            <svg viewBox={`0 0 ${page.width} ${page.height}`} className="h-32 w-32">
              {page.regions.map((region) => (
                <path
                  key={region.id}
                  d={regionPathData(region)}
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            <span className="text-sm font-medium text-[#1a1a1a]">{page.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the per-page route**

```tsx
// app/sketchbook/[pageId]/page.tsx
"use client";

import dynamic from "next/dynamic";
import { notFound, useParams } from "next/navigation";
import { SKETCHBOOK_PAGES } from "@/lib/sketchbookPages";

// Skip SSR, same reason as app/canvas/page.tsx: avoid hydrating against
// browser-only state (canvas/localStorage-backed identity).
const SketchbookCanvas = dynamic(
  () => import("@/components/SketchbookCanvas").then((m) => m.SketchbookCanvas),
  { ssr: false },
);

export default function SketchbookPageRoute() {
  const params = useParams<{ pageId: string }>();
  const pageId = params.pageId;

  if (!(pageId in SKETCHBOOK_PAGES)) {
    notFound();
  }

  return <SketchbookCanvas pageId={pageId} />;
}
```

- [ ] **Step 3: Update the sitemap to include every page**

In `app/sitemap.ts`, add the import and extend `routes`:

```ts
import type { MetadataRoute } from "next";
import { SKETCHBOOK_PAGES } from "@/lib/sketchbookPages";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";

  const routes = [
    "",
    "/canvas",
    "/draw-with-friends",
    "/online-whiteboard",
    "/infinite-canvas",
    "/sketchbook",
    ...Object.keys(SKETCHBOOK_PAGES).map((id) => `/sketchbook/${id}`),
  ];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/canvas" || route.startsWith("/sketchbook") ? "always" : "weekly",
    priority: route === "" || route === "/canvas" || route.startsWith("/sketchbook") ? 1.0 : 0.8,
  }));
}
```

- [ ] **Step 4: Run the full test suite and type-check**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass (repo total should be the same file count as before, since Task 1 renamed rather than added a file, plus the same 13 Convex tests from Task 3); no type errors anywhere in the repo, including `app/sketchbook/page.tsx` and `app/sketchbook/[pageId]/page.tsx`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, then:
- Open `http://localhost:3000/sketchbook` — verify it shows a small grid with two entries, "Flower" and "Circle", each rendering that page's actual outline as a thumbnail.
- Click "Flower" — verify it lands on `/sketchbook/flower` and behaves exactly as the single-page version did before this plan (paint clipped to regions, live sync, eraser, resize).
- Go back to `/sketchbook`, click "Circle" — verify `/sketchbook/circle` loads a small square page with one big circular region, colorable the same way.
- Open `/sketchbook/flower` and `/sketchbook/circle` in two different tabs — paint in each — verify a stroke on the flower never appears on the circle page and vice versa.
- Visit `/sketchbook/does-not-exist` — verify it renders Next's not-found page, not a crash or blank screen.

- [ ] **Step 6: Commit**

```bash
git add app/sketchbook/page.tsx app/sketchbook/[pageId]/page.tsx app/sitemap.ts
git commit -m "feat: split /sketchbook into a gallery and per-page routes"
```

---

## Self-Review Notes

- **Spec coverage:** Data/page registry (Task 1), routing split (Task 5), `SketchbookCanvas` prop-parameterization (Task 4), Convex schema/index/migration (Task 2), per-page `submit`/`listSince` scoping (Task 3), error handling for an unknown pageId at both the route level (Task 5's `notFound()`) and the Convex level (Task 3's thrown errors, reusing the existing client-side recovery path from the original spec), testing (Tasks 1 and 3's test files) — all covered. The migration's "manual, one-time, never auto-run" constraint is stated in Task 2's code comment and the plan's Global Constraints.
- **Placeholder scan:** none found; every step has runnable code.
- **Type consistency:** `SketchbookPage`/`SketchbookRegion` (Task 1) match exactly what Task 3's Convex functions and Task 4's component import and destructure (`page.width`/`page.height`/`page.regions`/`region.id`/`region.points`); `api.sketchbookStrokes.submit`/`listSince`'s `pageId`-bearing argument shapes (Task 3) match exactly what Task 4's component sends/requests; `SketchbookCanvas({ pageId })`'s prop name and type (Task 4) match exactly what Task 5's route passes.
