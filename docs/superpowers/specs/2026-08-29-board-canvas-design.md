# Board — a fixed-size, full-screen shared canvas — design spec

Status: approved by user, ready for implementation planning.

## Problem

The main wall is intentionally infinite and zoomable — great for a vast
shared mural, but that also means a first-time visitor can land anywhere,
zoomed to anything, with no sense of "the whole thing" at a glance. This
spec adds a second, independent shared canvas — **Board** — that is the
opposite on purpose: a fixed size, always fully visible at once, no zoom,
no pan. One single shared instance, publicly reachable (not invite-gated),
with the same full drawing toolset as the main wall (brushes, shapes,
stencils, colors, comments) and the same moderation parity (reporting,
admin wipe, rate limits) — since it's just as exposed to anonymous
strangers as the main wall is.

## Non-goals

- Multiple boards / a creation flow — exactly one shared Board instance
  for now, analogous to how the main wall is exactly one instance. A
  gallery of many boards is a different, not-yet-scoped feature.
- The snapshot-image replay optimization the main wall has
  (`snapshots.submit`/`getLatest` — a periodic rasterized bitmap used as a
  fast base layer instead of replaying every stroke). Board's world is
  small and bounded, so full-stroke replay should stay fast without it.
  Add it later only if replay time actually becomes a measured problem.
- Automatic/scheduled resets. The admin decided against this explicitly —
  Board only ever clears via an admin-triggered full wipe.
- Tile-based spatial culling/presence-scoping (`lib/tiling.ts`,
  `MAX_SCOPED_PRESENCE_TILES`, etc.) — that machinery exists solely to
  bound cost on the main wall's 20,000×20,000 world. Board's world
  (2400×1350) is always fully on-screen at once, so every stroke/cursor is
  always "visible" — tiling would add complexity with no benefit here.
- Private/invite-gated access, room membership — Board is fully public,
  same trust model as the main wall. (Unrelated to, and not blocked on,
  the separate not-yet-implemented "private rooms" feature discussed
  earlier — that remains its own future spec if pursued.)

## Architecture

### Data model (Convex)

New tables in `convex/schema.ts`, each mirroring its main-wall counterpart
field-for-field, with a `board` prefix instead of the tiling/snapshot
fields that don't apply:

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
  // Same soft-delete mechanism as strokes.deleted — see that field's
  // schema comment. A patched `deleted: true` + freshly-claimed sequence
  // is what makes an admin wipe show up reactively for every connected
  // client's incremental sync, not just the admin who triggered it.
  deleted: v.optional(v.boolean()),
})
  .index("by_sequence", ["sequence"])
  .index("by_clientStrokeId", ["clientStrokeId"])
  .index("by_clientId", ["clientId"]),

boardMetadata: defineTable({
  currentSequence: v.number(),
}),

boardPresence: defineTable({
  clientId: v.string(),
  username: v.optional(v.string()),
  countryCode: v.optional(v.string()),
  lastSeenAt: v.number(),
  cursorX: v.number(),
  cursorY: v.number(),
  laserTrail: v.optional(v.array(v.object({ x: v.number(), y: v.number(), timestamp: v.number() }))),
})
  .index("by_clientId", ["clientId"])
  .index("by_lastSeenAt", ["lastSeenAt"]),
// No tileKey/by_tileKey index — Board has no tiling (see Non-goals).

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
  commentId: v.optional(v.id("boardComments")),
  reason: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("reviewed"), v.literal("dismissed")),
  createdAt: v.number(),
})
  .index("by_status_and_createdAt", ["status", "createdAt"])
  .index("by_reporter", ["reporterId"]),
```

`boardReports` drops `minX/minY/maxX/maxY/zoom` (main wall's
`contentReports` fields for a drag-marked rectangle at a given zoom) since
Board has no zoom/pan to report a camera position or region against. This
means `targetType: "area"` on Board always means the main wall's existing
"quick report — just a camera position, no marked rectangle" case (see
the schema comment on `contentReports` above) — never the rectangle case,
which structurally can't happen without zoom/pan.

### Constants (`convex/constants.ts`)

New, separately-namespaced constants mirroring the main wall's values
(same numbers, own names — same pattern `SKETCHBOOK_STROKES_PER_CLIENT_WINDOW`
already established alongside `STROKES_PER_CLIENT_WINDOW`):

```ts
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
```

### New Convex modules

- `convex/boardMetadata.ts` — mirrors `convex/canvasMetadata.ts`'s
  `claimNextSequence` helper (an atomic read-patch-return on the single
  `boardMetadata` row, creating it on first use) — both `boardStrokes.submit`
  and `boardAdmin.wipeAll` need it, the same way `strokes.submit` and
  `wipeArea` share `canvasMetadata.ts`'s version today. Unlike
  `canvasMetadata`, `boardMetadata` stores only `currentSequence` — no
  `width`/`height` fields, since Board has exactly one fixed size
  (`BOARD_WIDTH`/`BOARD_HEIGHT` constants), not a per-instance
  configurable one.
- `convex/boardStrokes.ts` — `submit`/`listSince`/`getLatest`-shaped
  functions mirroring `convex/strokes.ts`, validated the same way
  (color/width/opacity/points bounds, profanity check on username,
  rate limits), but bounds-checked against `BOARD_WIDTH`/`BOARD_HEIGHT`
  instead of `WORLD_WIDTH`/`WORLD_HEIGHT`, and with no `tiles` field or
  tile-intersection logic (see Non-goals).
- `convex/boardPresence.ts` — `heartbeat`/`list` mirroring
  `convex/presence.ts`, minus `listByTiles`/`tileKey` (no tiling) and
  minus `onlineCount`'s cron-maintained counter (Board's presence table
  is small enough — bounded by the small canvas's realistic concurrent
  audience — that a direct `list` read is cheap; add the counter later
  only if that stops being true).
- `convex/boardComments.ts` — mirrors `convex/comments.ts` exactly
  (`create`/`remove`/`list`), swapping the table name.
- `convex/boardAdmin.ts` — a `wipeAll` mutation (passcode-gated via the
  existing shared `verifyAdminPasscode`, no new admin concept): pages
  through `boardStrokes` in `BOARD_WIPE_BATCH_SIZE` batches ordered by
  sequence, soft-deleting each via the same claim-next-sequence-then-patch
  pattern `wipeArea` uses — no area filter, since a Board wipe is always
  "the whole thing." Also a `reports`-queue read/resolve pair mirroring
  `admin.ts`'s existing comment/area report handling, scoped to
  `boardReports`/`boardComments`.

### Client: `components/GlobalCanvas.tsx`

Takes a new prop, `mode?: "wall" | "board"` (default `"wall"`, so every
existing call site is unaffected). Near the top of the component, a small
set of wrapper functions pick which Convex module to call based on
`mode` — same pattern as the earlier rooms design — so every one of the
~3,000 lines of drawing/tool/rendering logic below is unchanged and
mode-agnostic; it only ever calls through the wrappers.

Camera handling in `"board"` mode:
- On mount and on every window resize, the camera is set to
  `{ x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2, zoom: fitZoom }`, where
  `fitZoom = Math.min(viewportWidth / BOARD_WIDTH, viewportHeight / BOARD_HEIGHT)`
  — the whole board exactly fits the viewport, centered, same "fit"
  math `SketchbookCanvas.tsx` already uses for its own pages.
- Every zoom/pan input handler (wheel/trackpad-pinch zoom, `+`/`-`
  buttons, keyboard zoom shortcuts, click-drag panning) is disabled in
  this mode — the camera is set once per resize and never changes
  otherwise.
- The minimap is hidden in this mode (redundant when the whole board is
  always fully visible at once).
- Tile-scoped presence subscription logic
  (`subscribedTileKeys`/`MAX_SCOPED_PRESENCE_TILES`) is bypassed entirely
  in board mode — presence just subscribes to the one `boardPresence.list`
  query, unconditionally.

### Routing

New route `app/board/page.tsx`: `"use client"`, dynamically imports
`GlobalCanvas` with `ssr: false` (matching the main wall's own route
pattern) and renders `<GlobalCanvas mode="board" />`. Added to
`app/sitemap.ts` as its own entry, and linked from the homepage nav
alongside the existing Live Canvas/Sketchbook links.

## Error handling

- Rejections (validation failures, rate limits, profanity) follow the
  exact same `ConvexError` convention already established for the main
  wall's `strokes.ts`/`presence.ts`/`comments.ts` — plain `Error` gets
  redacted to a generic "Server Error" in production, so every
  user-facing rejection uses `ConvexError` with a specific message,
  same as the fix already applied to `snapshots.ts` earlier this
  session.
- `boardAdmin.wipeAll` returns `{ success: false, error }` rather than
  throwing on an invalid passcode, for the same durability reason
  `verifyAdminPasscode`'s doc comment already explains (a throw would
  undo the very rate-limit write meant to record the rejected attempt).

## Testing

Mirrors this codebase's established per-module test convention:

- `convex/boardStrokes.test.ts` — validation (color/width/opacity/point
  bounds against `BOARD_WIDTH`/`BOARD_HEIGHT`), dedup by
  `clientStrokeId`, rate limiting (per-client and global), profanity
  check on username — same test shapes as `strokes.test.ts`.
- `convex/boardPresence.test.ts` — heartbeat validation, username
  profanity, `list` returning countryCode/laserTrail — same shapes as
  `presence.test.ts`, minus the tile-scoping tests (not applicable).
- `convex/boardComments.test.ts` — create/remove/list, ownership check on
  delete (mirroring the fix earlier this session that gated the
  Delete button to a comment's own author), profanity/length bounds —
  same shapes as `comments.test.ts`.
- `convex/boardAdmin.test.ts` — `wipeAll` only soft-deletes (never a real
  row delete), converges a backlog larger than `BOARD_WIPE_BATCH_SIZE`
  over multiple calls without ever reading unboundedly in one call (same
  regression-test shape as `snapshots.test.ts`'s bounded-batch-pruning
  test, since that was a real production incident this session), wrong
  passcode is rejected without wiping anything.
- No render/component test for `GlobalCanvas`'s new `mode` prop or the
  camera-lock behavior — this codebase has no React component-rendering
  test infrastructure (confirmed: only one non-rendering component test
  exists, `BrushCursor.test.ts`). Verified instead via live browser
  check (two tabs, confirm draw/comment/presence sync, confirm zoom
  input has no effect) before considering the task done, same as every
  other UI-behavior change this session.
