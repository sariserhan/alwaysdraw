# Shared/live sketchbook — design spec

Status: approved by user, ready for implementation planning.
Sub-project 1 of 2 (personal solo sketchbook is a separate, later spec).

## Problem

The app currently has exactly one shared drawing surface: the global
infinite canvas (`components/GlobalCanvas.tsx`, one `strokes` table, one
`canvasMetadata` singleton). The other routes (`/draw-with-friends`,
`/infinite-canvas`, `/online-whiteboard`) are SEO landing pages pointing at
that same canvas — there is no other kind of canvas in the app.

We're adding a second, independent kind of shared canvas: a "sketchbook"
page. It shows one predefined line-art outline (e.g. a flower). Everyone
online colors it together in real time, like the main canvas, but:

- The outline artwork itself can never be erased or altered — it isn't
  user-editable data at all, it's fixed line art.
- Color can only be applied inside the outline's regions, never outside
  them (no coloring off the edges of the flower).

## Non-goals (this spec)

- Personal/solo sketchbook (separate spec, sub-project 2).
- Multiple outline pages / a picker gallery — ships with exactly one
  hardcoded outline.
- Raster/flood-fill region detection — regions are hand-authored SVG
  shapes.
- Presence cursors, laser trails, or any of the main canvas's richer
  multiplayer feedback — just realtime-synced paint strokes.
- Brush texture selection (the 13 `BRUSH_TYPES` catalog) — one simple
  round brush, matching the "fixed set of colors + brush width" scope
  agreed with the user.
- Pan/zoom interaction — the page scales to fit the viewport once; no
  drag-to-pan, no scroll-to-zoom.

## Architecture

### Route & component

- New route `app/sketchbook/page.tsx`, mirroring `app/canvas/page.tsx`:
  dynamically imports the client component with `ssr: false` to avoid
  hydrating against browser-only state.
- New component `components/SketchbookCanvas.tsx`. Not built on top of
  `GlobalCanvas` — it doesn't need infinite pan/zoom, tiling, presence, or
  most of the existing toolbar. It's a small, self-contained component:
  one fixed-size paint `<canvas>`, one outline `<svg>` overlay, a color
  swatch row, a brush-width slider, an eraser toggle.

### The outline-lock mechanic

New file `lib/sketchbookOutline.ts` defining the one hardcoded outline for
v1 — **pure data only** (no `Path2D`, no DOM APIs), so it's safely
importable from both the browser and Convex's server runtime (which has
no DOM and would throw on `new Path2D(...)` at module scope). This
mirrors the existing cross-import pattern already in the codebase
(`lib/types.ts` imports `BRUSH_TYPES` from `@/convex/constants`):

```ts
export type SketchbookRegion = { id: string; path: string }; // SVG path `d`
export const SKETCHBOOK_PAGE_WIDTH = 800;
export const SKETCHBOOK_PAGE_HEIGHT = 1000;
export const SKETCHBOOK_REGIONS: SketchbookRegion[] = [ /* flower: petals x5, center, stem, 2 leaves */ ];
```

`convex/sketchbookStrokes.ts` imports `SKETCHBOOK_REGIONS` from this same
module for server-side `regionId` validation (see Data model below) —
there is exactly one definition of the region list, never a
server-mirrored copy that could drift from the client's.

Rendering order (paint below, line art on top, exactly like a real
coloring book):

1. Paint `<canvas>` — where all colored-in strokes are rendered.
2. Outline `<svg>` — absolutely positioned over the canvas, same
   `viewBox="0 0 800 1000"`, `pointer-events: none`, renders each
   region's `path` with black stroke / transparent fill. This is static
   JSX built from `SKETCHBOOK_REGIONS`; it is never written to by any
   user action, so "can't be erased" needs no enforcement code — there is
   no code path that touches it.

Clipping paint to a region:

- In `SketchbookCanvas.tsx` (client-only), build one `Path2D` per region
  from `SKETCHBOOK_REGIONS` in a `useMemo` — this is the one place
  `Path2D` gets constructed; small enough to live inline rather than its
  own module.
- On `pointerdown`, convert the event's screen coordinates to page-local
  coordinates via `lib/coordinates.ts`'s `screenToWorld` (reused as-is,
  fed the same scale-to-fit `Camera` described below) and find the
  containing region via `ctx.isPointInPath(path2D, x, y)`, checked
  against each region in order. If no region contains the point, the pointer-down is ignored
  (no stroke starts) — this covers taps outside the flower entirely and
  taps on outline gaps/lines.
- The region found at pointer-down is fixed for that whole drag (a
  physical marker doesn't teleport to a new area mid-stroke either).
  Store it as `activeRegionId` for the duration of the drag.
- Every redraw of an in-progress or committed stroke wraps its draw call
  in `ctx.save(); ctx.clip(regionPath2D); <draw>; ctx.restore()` so ink
  can never render outside that region's boundary, even if the pointer
  drags past the outline's edge.
- The eraser tool follows the identical clip: it can only erase paint
  strokes, clipped to the same region, so it can never interact with the
  (non-canvas, non-erasable) outline SVG layer.

### Coordinates & scale-to-fit

Reuses the existing `Camera`/`worldToScreen` machinery from
`lib/camera.ts` / `lib/coordinates.ts` rather than inventing new
coordinate math — "world" here is just the fixed page space
`800 x 1000`. On mount and on resize, compute a `Camera` with
`zoom = min(viewportW / 800, viewportH / 1000)` and `x`/`y` set to center
the page in the viewport. This camera is recomputed on resize but never
changes from pointer input (no pan/zoom gestures wired up), so it can be
plain `useState`/`useEffect`, no ref-based animation loop needed.

### Drawing/rendering reuse

- `lib/drawing.ts`'s `drawStroke` / `drawSegment` are reused as-is for
  rendering both paint and erase strokes (its `mode === "erase"` branch
  already does `globalCompositeOperation = "destination-out"`, which is
  exactly what the eraser needs) — called inside the
  `ctx.save()/clip()/restore()` wrapper described above.
- `lib/strokeBuffer.ts`'s `StrokeBuffer` class is reused unmodified for
  buffering in-progress-drag points into ~40-point/~60ms chunks. Its
  `brushType` field is always passed as `undefined` (no texture catalog
  in scope).
- `lib/identity.ts`'s `getClientId` / `getUsername` / `getCachedCountryCode`
  are reused unmodified for stroke attribution — same anonymous-client
  identity model as the main canvas.

### Data model (Convex)

Separate tables from the main canvas — deliberately not generalizing
`strokes`/`canvasMetadata` into a multi-canvas system for this. New file
`convex/schema.ts` additions:

```ts
sketchbookStrokes: defineTable({
  clientStrokeId: v.string(),
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  mode: v.union(v.literal("draw"), v.literal("erase")),
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

No `tiles` field (fixed small page, no spatial sharding needed) and no
`brushType` field (no texture catalog in scope). `regionId` is new,
validated server-side by importing `SKETCHBOOK_REGIONS` directly from
`lib/sketchbookOutline.ts` (see above) and rejecting any id not in that
list — a single source of truth shared with the client, not a
server-side copy that could drift.

New file `convex/sketchbookMetadata.ts`, mirroring
`convex/canvasMetadata.ts`'s `claimNextSequence` exactly (transactional
read-increment-write singleton), just against `sketchbookMetadata`.

New file `convex/sketchbookStrokes.ts`, mirroring
`convex/strokes.ts`'s `submit` and `listSince` closely:

- `submit` mutation: same validation shape as `strokes.submit` —
  `assertWritesEnabled`, `assertBoundedIdentifier` on `clientId` /
  `clientStrokeId`, bounds-check `width` (reuse `MIN_BRUSH_WIDTH` /
  `MAX_BRUSH_WIDTH`), bounds-check `points.length` (reuse
  `MIN_POINTS_PER_STROKE` / `MAX_POINTS_PER_STROKE`), validate `color`
  against `COLOR_PATTERN`, validate `opacity` range, validate `username`
  (profanity check, length) and `countryCode` pattern the same way. Point
  coordinates are checked against `[0, SKETCHBOOK_PAGE_WIDTH] x
  [0, SKETCHBOOK_PAGE_HEIGHT]` instead of `WORLD_WIDTH`/`WORLD_HEIGHT`.
  `regionId` is validated against the known region id set — reject
  unknown ids. Idempotent on `clientStrokeId`, same early-return pattern.
  Rate-limited via the existing `consumeRateLimit` helper against new
  constants `SKETCHBOOK_STROKES_PER_CLIENT_WINDOW` /
  `SKETCHBOOK_STROKES_GLOBAL_WINDOW` in `convex/constants.ts` (separate
  budget from the main canvas's, so heavy sketchbook use can't starve
  main-canvas writes or vice versa). No protected-zones / admin-passcode
  logic — out of scope for a coloring page.
- `listSince` query: identical shape to `strokes.listSince`
  (`afterSequence`, `limit`, same `DEFAULT_LIST_LIMIT`/`MAX_LIST_LIMIT`
  clamp), reading from `sketchbookStrokes` by its own `by_sequence` index.

### Client sync

`SketchbookCanvas` polls via `listSince` as a reactive Convex query (same
incremental-sync-by-sequence pattern the main canvas already proves out:
track `afterSequence` in state, the query result is the delta, append new
strokes to a local render list, bump `afterSequence` to the max sequence
seen). No presence/cursor layer — colors from other visitors simply
appear as their strokes sync in.

## Error handling

- Pointer-down outside every region: no-op, no stroke starts (see
  Clipping above) — not an error state, just nothing happens.
- `submit` rejects strokes with an unknown `regionId`, out-of-bounds
  points, or malformed color/width/opacity with the same
  `throw new Error(...)` pattern `strokes.submit` uses — the client
  simply drops strokes that fail to submit (matches existing behavior
  for the main canvas; no retry-with-backoff in scope).
- Rate limit exceeded: `consumeRateLimit` throws, surfaced to the user
  the same way the main canvas already surfaces its rate-limit errors
  (existing toast/error-message plumbing, reused as-is).

## Testing

- `convex/sketchbookStrokes.test.ts`, mirroring the structure of
  `convex/strokes.test.ts`: valid submit returns a sequence; duplicate
  `clientStrokeId` is idempotent; out-of-bounds point rejected; unknown
  `regionId` rejected; invalid color rejected; rate limit enforced;
  `listSince` returns only strokes after the given sequence.
- `lib/sketchbookOutline.test.ts`: each region's `Path2D` is constructable
  from its `d` string without throwing, and a handful of known
  inside/outside sample points resolve to the expected region (or no
  region) via `isPointInPath` — this is the core "can't color outside the
  lines" guarantee, so it gets a direct test rather than relying only on
  manual verification. (This test runs in a DOM-enabled test environment
  for `Path2D`/`isPointInPath`, same as any other browser-API test in
  this codebase — it exercises the data from `lib/sketchbookOutline.ts`,
  not a `Path2D` embedded in the module itself.)
