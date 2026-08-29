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
  // Off (undefined/false) by default — the pruning cron always fires on
  // schedule (Convex crons are static, deploy-time configuration; there's
  // no way to register/unregister one at runtime), but pruneDeletedStrokes
  // checks this flag first and no-ops entirely if it's off. An admin
  // opts in via the admin panel when they actually want old soft-deleted
  // rows cleaned up automatically.
  autoPruneEnabled: v.optional(v.boolean()),
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

`boardReports` keeps the main wall's drag-marked-rectangle reporting
(`minX/minY/maxX/maxY`) — a rectangle-select gesture only needs *some*
screen↔world coordinate transform, not a *variable* one, and Board still
has that transform (it's just fixed instead of user-adjustable). The only
field actually dropped is `zoom`, since Board's zoom is always the same
computed `fitZoom` value — recording it on every report would be
redundant, not meaningful history.

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
// Presence list is bounded the same way presence.list already is (see
// MAX_PRESENCE_LIST) — a public, anonymous, zero-signup page must never
// assume its own realistic traffic; it must be bounded regardless of how
// many people actually show up.
export const BOARD_MAX_PRESENCE_LIST = 50;
// Soft-deleted boardStrokes rows (from wipeAll) are hard-deleted after this
// long — long enough that any client's incremental listSince sync has
// certainly already observed the deletion (see the pruning cron below).
// Board has no snapshot-image cushion (see Non-goals), so unlike the main
// wall, unpruned deleted rows directly inflate every future replay's cost.
export const BOARD_DELETED_STROKE_RETENTION_MS = 24 * 60 * 60 * 1000;
export const BOARD_PRUNE_BATCH_SIZE = 500;
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
  `convex/presence.ts`, minus `listByTiles`/`tileKey` (no tiling). `list`
  is explicitly bounded exactly like `presence.list` already is: filtered
  to `lastSeenAt >= Date.now() - PRESENCE_ONLINE_WINDOW_MS` via the
  `by_lastSeenAt` index, then `.take(BOARD_MAX_PRESENCE_LIST)` — never an
  unbounded read, regardless of how much traffic actually arrives. Also
  minus `onlineCount`'s cron-maintained counter for now (the bounded
  `list` read stays cheap either way; add the counter later only if a
  bare read count query is ever needed independent of the full list).
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
- `convex/boardAdmin.ts` also exports `pruneDeletedStrokes`, an
  `internalMutation` run on a new cron (`convex/crons.ts`, alongside the
  existing `clear stale presence`/`recompute online count` jobs — e.g.
  every 10 minutes). **Opt-in, off by default**: the very first thing the
  handler does is read `boardMetadata.autoPruneEnabled` and return
  immediately (no reads/writes beyond that one row) if it isn't `true` —
  the cron itself always fires on schedule (Convex crons are static,
  deploy-time configuration with no runtime enable/disable), but the
  function it calls is a no-op until an admin turns it on. When enabled,
  it pages through `boardStrokes` via the `by_sequence` index in
  `BOARD_PRUNE_BATCH_SIZE` batches, hard-deleting (`ctx.db.delete`, not a
  patch) any row where `deleted === true` and `serverTimestamp <
  Date.now() - BOARD_DELETED_STROKE_RETENTION_MS`. Also exports
  `setAutoPruneEnabled` (passcode-gated via `verifyAdminPasscode`, same
  as every other admin mutation), which patches
  `boardMetadata.autoPruneEnabled` — this is what the admin panel's
  toggle (see Admin UI below) actually calls.

  This is the mechanism that keeps Board's "full-stroke replay stays
  cheap" assumption (see Non-goals) true over time *if* an admin opts
  into it — unlike the main wall's `strokes` table, which has no
  equivalent cleanup today and relies on the snapshot-image optimization
  to stay affordable despite that; Board has no such cushion, so leaving
  this off indefinitely means accepting the same unbounded-growth
  characteristic the main wall already has, as a deliberate choice, not
  an oversight. Safe to hard-delete when enabled: a row only reaches this
  state well after every connected client's incremental `listSince` sync
  has already observed and applied its `deleted: true` patch, and a
  client that reconnects later and replays from scratch correctly never
  sees a hard-deleted row at all — the same "gone" outcome a
  soft-deleted-but-never-pruned row already produces, just without the
  storage/replay cost of keeping it around forever.

### Client: `components/GlobalCanvas.tsx`

Rather than scattering `mode === "board"` checks through an already
~3,000-line component, `GlobalCanvas` takes a new prop, `mode?: "wall" |
"board"` (default `"wall"`, so every existing call site is unaffected),
and resolves it to a single **`CanvasBackend`** adapter object up front:

```ts
// lib/canvasBackend.ts
export interface CanvasBackend {
  strokesApi: {
    submit: typeof api.strokes.submit | typeof api.boardStrokes.submit;
    listSince: typeof api.strokes.listSince | typeof api.boardStrokes.listSince;
    getLatest: typeof api.strokes.getLatest | typeof api.boardStrokes.getLatest;
  };
  presenceApi: {
    heartbeat: typeof api.presence.heartbeat | typeof api.boardPresence.heartbeat;
    list: typeof api.presence.list | typeof api.boardPresence.list;
  };
  commentsApi: {
    create: typeof api.comments.create | typeof api.boardComments.create;
    remove: typeof api.comments.remove | typeof api.boardComments.remove;
    list: typeof api.comments.list | typeof api.boardComments.list;
  };
  worldWidth: number;
  worldHeight: number;
  supportsZoomPan: boolean;
  showMinimap: boolean;
}

export const wallBackend: CanvasBackend = {
  strokesApi: { submit: api.strokes.submit, listSince: api.strokes.listSince, getLatest: api.strokes.getLatest },
  presenceApi: { heartbeat: api.presence.heartbeat, list: api.presence.list },
  commentsApi: { create: api.comments.create, remove: api.comments.remove, list: api.comments.list },
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  supportsZoomPan: true,
  showMinimap: true,
};

export const boardBackend: CanvasBackend = {
  strokesApi: { submit: api.boardStrokes.submit, listSince: api.boardStrokes.listSince, getLatest: api.boardStrokes.getLatest },
  presenceApi: { heartbeat: api.boardPresence.heartbeat, list: api.boardPresence.list },
  commentsApi: { create: api.boardComments.create, remove: api.boardComments.remove, list: api.boardComments.list },
  worldWidth: BOARD_WIDTH,
  worldHeight: BOARD_HEIGHT,
  supportsZoomPan: false,
  showMinimap: false,
};
```

`GlobalCanvas` does `const backend = mode === "board" ? boardBackend :
wallBackend;` once, then every existing `useMutation(api.strokes.submit)`
/ `useQuery(api.presence.list, ...)` call site becomes
`useMutation(backend.strokesApi.submit)` / `useQuery(backend.presenceApi.list,
...)` — the ~3,000 lines of drawing/tool/rendering logic below are
otherwise unchanged and never reference `mode` directly, only `backend`'s
fields. Tile-scoped presence subscription logic
(`subscribedTileKeys`/`MAX_SCOPED_PRESENCE_TILES`) is skipped whenever
`backend.showMinimap` is false (Board never has enough world-space to
need tile scoping — see Non-goals) — presence subscribes to
`backend.presenceApi.list` unconditionally in that case.

Camera handling when `backend.supportsZoomPan` is false:
- On mount and on every window resize, the camera is set to
  `{ x: backend.worldWidth / 2, y: backend.worldHeight / 2, zoom: fitZoom }`,
  where `fitZoom = Math.min(viewportWidth / backend.worldWidth, viewportHeight / backend.worldHeight)`
  — the whole board exactly fits the viewport, centered, same "fit"
  math `SketchbookCanvas.tsx` already uses for its own pages.
- Every zoom/pan input handler (wheel/trackpad-pinch zoom, `+`/`-`
  buttons, keyboard zoom shortcuts, click-drag panning) is disabled — the
  camera is set once per resize and never changes otherwise.
- The minimap is hidden (`backend.showMinimap` is false) — redundant when
  the whole board is always fully visible at once.
- **Letterboxing**: when the viewport's aspect ratio doesn't match
  `BOARD_WIDTH`/`BOARD_HEIGHT` (e.g. a phone, an ultrawide monitor),
  `fitZoom` leaves a margin on two sides rather than cropping or
  stretching the board. That margin renders as plain background (the
  same chrome background color the rest of the app's chrome uses, not
  the board's paper color) so it visually reads as "outside the canvas,"
  not as empty drawable space.
- Pointer input outside the board's rect (inside that letterboxed margin)
  is ignored for drawing purposes — it never starts a stroke. This is a
  client-side UX guard on top of (not instead of) the server-side bounds
  check `boardStrokes.submit` already does against `BOARD_WIDTH`/`BOARD_HEIGHT`
  (see New Convex modules above), the same defense-in-depth relationship
  the main wall already has between its own client-side clamping and
  `strokes.submit`'s server-side `WORLD_WIDTH`/`WORLD_HEIGHT` bounds check.

### Admin UI (`components/AdminPanelModal.tsx`)

A new toggle in the existing admin panel — same passcode-gated surface
every other admin control already lives in, no new UI surface. Reads
`boardMetadata.autoPruneEnabled` (a small new query,
`boardAdmin.getAutoPruneEnabled`) and renders it as an on/off switch
labeled "Auto-prune deleted Board strokes," calling
`boardAdmin.setAutoPruneEnabled` on toggle — same
request/response/error-display pattern the panel's other admin actions
(wipe, zone create/delete) already use.

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
  passcode is rejected without wiping anything. Also covers
  `pruneDeletedStrokes`: **with `autoPruneEnabled` unset/false (the
  default), a row marked `deleted: true` with an old `serverTimestamp` is
  left untouched** — this is the primary regression test for the feature
  flag itself, since silently pruning by default is exactly the behavior
  the user explicitly opted out of. With `autoPruneEnabled: true` (set via
  `setAutoPruneEnabled` in the test setup): a row marked `deleted: true`
  with an old enough `serverTimestamp` is hard-deleted
  (`ctx.db.query("boardStrokes")` no longer finds it at all, not just
  filtered); a row marked `deleted: true` too recently is left alone; a
  non-deleted row is never pruned regardless of age; a backlog larger than
  `BOARD_PRUNE_BATCH_SIZE` converges over multiple calls, same
  bounded-batch shape as the `wipeAll` test above. Also covers
  `setAutoPruneEnabled`: requires a valid passcode (wrong passcode leaves
  the flag unchanged), and `getAutoPruneEnabled` reflects the current
  value.
- No unit/component-render test for `GlobalCanvas`'s new `mode` prop or
  the camera-lock behavior itself — this codebase has no React
  component-rendering test infrastructure (confirmed: only one
  non-rendering component test exists, `BrushCursor.test.ts`). It does,
  however, have Playwright e2e infrastructure already
  (`e2e/multiplayer.spec.ts`, `e2e/sketchbook.spec.ts`, `npm run
  test:e2e`), which is the right tool for exactly this behavior. New
  `e2e/board.spec.ts`: load `/board`, capture the canvas element's
  bounding rect and the rendered stroke path for a drawn mark; dispatch a
  wheel-zoom event and a simulated pinch; assert the canvas's bounding
  rect and camera-derived stroke position are byte-identical before and
  after (proving zoom input had zero effect) — this is Board's single
  defining behavioral difference from every other canvas in the app, so
  it gets a real regression test, not just a manual check.
