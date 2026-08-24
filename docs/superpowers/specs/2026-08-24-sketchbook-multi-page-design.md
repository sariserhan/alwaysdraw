# Multi-page sketchbook gallery — design spec

Status: approved by user, ready for implementation planning.
Sub-project 3, building on the shipped shared/live sketchbook
(`docs/superpowers/specs/2026-08-24-shared-sketchbook-design.md`).

## Problem

The shipped `/sketchbook` shows exactly one hardcoded outline (a flower) —
explicitly out of scope for that spec: "Multiple outline pages / a picker
gallery — ships with exactly one hardcoded outline." This spec adds that:
a gallery of pages to choose from, each an independent shared/live
coloring canvas, so new outline art (starting with a page the user will
download and hand off next) can be added without redoing the architecture
each time.

## Non-goals

- Actually sourcing/authoring the user's next downloaded outline as
  polygon region data — that happens in a follow-up once they hand off
  the file. This spec only builds the multi-page *system* and ships it
  with two pages: the existing flower, plus one new minimal placeholder
  (see Content below) to prove — and test — that more than one page
  actually works end to end.
- Personal/solo sketchbook (still a separate, not-yet-started spec).
- Raster/flood-fill region detection, brush textures, pan/zoom — same
  non-goals as the original spec, unchanged.
- Deleting or archiving pages — out of scope; the registry only grows for
  now.

## Content: shipping with two pages

A gallery of one item doesn't exercise the thing being built — the
compound Convex index that scopes strokes to a page, the gallery grid
layout, and the "does page A's paint stay out of page B's data" guarantee
all need a second real page to prove. This spec adds one minimal
placeholder second page (a single circle, one region, `400x400`) alongside
the existing flower. It's disposable: replacing it with the user's real
downloaded art later is a content-only change (see Architecture below),
not a repeat of this spec's work.

## Architecture

### Data: `lib/sketchbookOutline.ts` → `lib/sketchbookPages.ts`

Renamed and restructured from "one outline" to "a registry of pages".
`SketchbookRegion` and the three pure functions
(`isPointInRegion`/`findRegionAt`/`regionPathData`) are unchanged — they
already operate on a page-agnostic `regions: SketchbookRegion[]`, no
edits needed there.

```ts
export type SketchbookPage = {
  id: string;
  title: string;
  width: number;
  height: number;
  regions: SketchbookRegion[];
};

export const SKETCHBOOK_PAGES: Record<string, SketchbookPage> = {
  flower: {
    id: "flower",
    title: "Flower",
    width: 800,
    height: 1000,
    regions: [ /* the existing 9 regions, moved here unchanged */ ],
  },
  circle: {
    id: "circle",
    title: "Circle",
    width: 400,
    height: 400,
    regions: [{ id: "circle", points: /* one big centered circle */ }],
  },
};

// Legacy sketchbookStrokes rows written before multi-page support have no
// pageId — the one-time backfill migration (see Data model) assigns them
// to this page, since it's the only page that existed at the time.
export const DEFAULT_SKETCHBOOK_PAGE_ID = "flower";
```

`SKETCHBOOK_PAGE_WIDTH`/`SKETCHBOOK_PAGE_HEIGHT`/`SKETCHBOOK_REGIONS` (the
old top-level exports) are removed — every current importer switches to
`SKETCHBOOK_PAGES[pageId].width/height/regions`.

### Routing

- `app/sketchbook/page.tsx` becomes the **gallery**: a plain server
  component (no `"use client"`, no dynamic import — it renders static
  markup and touches no browser-only state, unlike the canvas itself).
  It lists `Object.values(SKETCHBOOK_PAGES)` as a grid of links, each
  showing that page's own outline rendered small (`<svg viewBox="0 0
  {width} {height}">` + one `<path d={regionPathData(region)}>` per
  region, same rendering the canvas itself uses) — no separate thumbnail
  image asset to generate, author, or keep in sync with the real outline.
- `app/sketchbook/[pageId]/page.tsx` (new) is today's canvas experience,
  parameterized: `"use client"`, reads `pageId` via `useParams()`, calls
  `notFound()` (from `next/navigation`) if `pageId` isn't a key in
  `SKETCHBOOK_PAGES`, otherwise dynamically imports `SketchbookCanvas`
  with `ssr: false` (unchanged reasoning) and renders `<SketchbookCanvas
  pageId={pageId} />`.
- The homepage nav link (`app/page.tsx`) and the `/sketchbook` sitemap
  entry both already point at `/sketchbook` — unchanged, since that URL
  now correctly lands on the gallery. `app/sitemap.ts` additionally maps
  over `SKETCHBOOK_PAGES` to emit one `/sketchbook/{id}` entry per page
  automatically, so a future third page gets sitemap coverage for free
  without touching this file again.

### `components/SketchbookCanvas.tsx`

Takes a new required prop: `pageId: string`. The route guarantees this is
always a valid key (see Routing above), so the component looks it up
directly: `const page = SKETCHBOOK_PAGES[pageId]`. Every current use of
`SKETCHBOOK_PAGE_WIDTH`/`SKETCHBOOK_PAGE_HEIGHT`/`SKETCHBOOK_REGIONS`
(camera sizing, `clampToPage`, region hit-testing, the outline `<svg>`,
the resize-time screen-space `Path2D` rebuild) becomes `page.width` /
`page.height` / `page.regions`. `clampToPage` takes the page's
width/height as parameters instead of the old module-level constants.
`liveTail` becomes `useQuery(api.sketchbookStrokes.listSince, { pageId,
afterSequence })`, and `submitStroke`'s mutation call gains `pageId` in
its args, alongside the `regionId` it already sends. No other behavior
changes — clipping, replay-on-resize, the error-recovery path, and the
toolbar are all page-agnostic already.

### Data model (Convex)

**Schema** (`convex/schema.ts`): `sketchbookStrokes` gains `pageId:
v.optional(v.string())` and a new compound index
`.index("by_pageId_and_sequence", ["pageId", "sequence"])`, alongside the
existing `by_sequence`/`by_clientStrokeId`. `pageId` stays `v.optional` at
the schema level deliberately (see Migration below) even though the
application guarantees every row has a real value after the migration
runs and from then on — this avoids a second, ordering-sensitive schema
deploy (tighten-after-backfill) for a guarantee the application layer
already enforces.

**Migration** (new `convex/migrations.ts`): a one-time `internalMutation`,
`backfillSketchbookPageId`, that pages through `sketchbookStrokes` rows
where `pageId` is undefined and patches them to
`DEFAULT_SKETCHBOOK_PAGE_ID` ("flower") — the only page that existed
before this spec, so every pre-existing row genuinely belongs there. This
matters because Convex's `by_pageId_and_sequence` index only matches rows
that actually have a `pageId` value: an un-backfilled row is invisible to
`listSince("flower", ...)` even though it's conceptually a flower stroke,
so skipping this step would make today's test strokes vanish from view
(not delete them — they'd still exist, just unreachable through the new
per-page query). **This migration is written as part of this spec's
implementation but is a manual, one-time operational step — the user runs
it themselves (`npx convex run migrations:backfillSketchbookPageId`)
against their own deployment once the code is live; it is not invoked
automatically by any task or test in this plan.**

**`convex/sketchbookStrokes.ts` changes:**
- `submit`'s args gain `pageId: v.string()` (required, unlike the
  schema's optional storage field — every new write always provides it).
  Validation: `SKETCHBOOK_PAGES[args.pageId]` must exist (`throw new
  Error(\`unknown pageId: ${args.pageId}\`)` if not); `regionId` is then
  validated against *that page's* `regions` (not a flattened set across
  all pages — two pages could reuse the same region id, e.g. both having
  a `"center"`, without colliding); the points-bounds check uses that
  page's own `width`/`height` instead of the old module constants.
- `listSince`'s args gain `pageId: v.string()` (required), validated the
  same way. The query switches from the `by_sequence` index to
  `by_pageId_and_sequence`: `.withIndex("by_pageId_and_sequence", q =>
  q.eq("pageId", args.pageId).gt("sequence", args.afterSequence))` — so a
  viewer on one page only ever receives that page's strokes, never
  another page's.
- Rate limiting is unchanged: the same two shared constants
  (`SKETCHBOOK_STROKES_PER_CLIENT_WINDOW`/`_GLOBAL_WINDOW`) apply across
  all pages combined, not a per-page budget — simpler, and a determined
  user coloring many pages fast is still bounded overall.
- The sequence counter (`convex/sketchbookMetadata.ts`) is unchanged: one
  global counter shared across all pages. Sequence numbers only need to
  be unique and increasing for the incremental-sync protocol to work —
  nothing requires them to be contiguous per page — so fragmenting
  `sketchbookMetadata` into one row per page would add complexity for no
  correctness benefit.

## Error handling

- An unknown `pageId` hit via URL (`/sketchbook/nonexistent`) renders
  Next's not-found page via `notFound()` in the route component — no
  network round-trip needed, since `SKETCHBOOK_PAGES` is available
  client-side.
- An unknown `pageId` reaching `submit`/`listSince` directly (a crafted
  request bypassing the route's own check) is rejected the same way
  `regionId` already is: a thrown `Error`, causing the client's existing
  submit-failure recovery path (added in the original spec's final review
  fix wave) to un-paint the rejected stroke and show the existing error
  banner — no new client-side handling needed for this case.

## Testing

- `lib/sketchbookPages.test.ts` (renamed from `sketchbookOutline.test.ts`):
  existing region hit-testing assertions move to testing
  `SKETCHBOOK_PAGES.flower.regions`; add equivalent coverage for the new
  `circle` page (a point at its center resolves to `"circle"`, a point
  outside resolves to `null`); add a test that every page in
  `SKETCHBOOK_PAGES` has unique region ids *within that page* (not
  globally — two pages may reuse an id).
- `convex/sketchbookStrokes.test.ts`: existing tests gain `pageId:
  "flower"` in their base args; add tests for: `submit` rejects an
  unknown `pageId`; `submit` rejects a `regionId` valid on one page but
  not the page named in the same call (e.g. `pageId: "circle"` with
  `regionId: "petal-1"`); `listSince` for one `pageId` never returns
  strokes submitted under a different `pageId` (submit one stroke each to
  `"flower"` and `"circle"`, assert each page's `listSince` only shows
  its own).
- No test for the migration mutation itself — it's a one-time operational
  script, not application logic; correctness there is "does it compile
  and match the intended patch," verified by reading the diff rather than
  a Convex-test round-trip against seeded legacy rows.
