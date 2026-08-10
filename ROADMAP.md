# AlwaysDraw Roadmap

One world. One canvas. Always drawing.

This tracks the full product vision (versions 1–5, as originally scoped) against what's actually shipped, plus the running backlog. See [README.md](README.md) for setup/deploy/testing instructions and [DESIGN.md](DESIGN.md) for the visual system. This file is about *what*, those are about *how*.

Status shorthand: ✅ shipped · 🚧 in progress · ⏳ planned, not started.

---

## Where things stand

**V1 is shipped and substantially exceeds its original scope.** The base spec (single shared canvas, local-first drawing, presence, mobile support) is done, and a live design/feedback pass on top of it added a full visual identity, a 13-tool brush system, dual themes, and a live cursor preview — none of which were in the original V1 spec but came out of building it and using it. V2–V5 are unstarted by design: the original instructions were explicit that V2+ waits until V1 proves itself with real traffic.

---

## V1 — Functional MVP ✅ shipped (and then some)

### Original scope (from the initial spec)
- [x] Next.js + TypeScript + Tailwind + Convex, no accounts, no rooms, no undo
- [x] Single global canvas, viewport-sized `<canvas>` + camera (pan/zoom), not a giant DOM element
- [x] Root URL opens directly into the canvas — no homepage, no onboarding
- [x] Local-first drawing (draws before the network round-trip)
- [x] Batched stroke submission (~40ms / ~40 points per chunk)
- [x] Server-sequenced, append-only stroke history (no client-trusted ordering)
- [x] Convex reactive live sync (draw/erase visible to others in near real time)
- [x] Eraser stored as an operation (`mode: "erase"`), never a deletion
- [x] Anonymous identity (`anon-XXXXXX` in localStorage) — convenience, not auth
- [x] Approximate online count via presence heartbeat + staleness window
- [x] Remote cursors (capped, hidden after inactivity)
- [x] Abuse-boundary validation: brush width, point count, coordinate bounds, color format, no NaN/Infinity
- [x] Desktop input (drag/wheel/space-drag) + mobile input (1-finger draw, 2-finger pan/pinch)
- [x] Reload reconstructs the shared canvas from history
- [x] Two-layer canvas (world + strokes) so erasing reveals the wall, not the page background — added after the original single-layer approach turned out to make erasing look broken
- [x] World size: 5,000×5,000 → bumped to **10,000×10,000** per request

### Visual identity ✅ (via the Impeccable design pass — not in the original spec)
- [x] PRODUCT.md + DESIGN.md: a committed visual world, **"The Bolted Rack"** — a rusted train-yard wall, riveted steel chrome, no whiteboard-SaaS look
- [x] Dark theme (default, deliberate) + light theme (manual, persisted toggle)
- [x] Plain canvas ground, a warm paper tone (not stark white) — a grid/crack texture was tried and pulled after real use competed visually with actual strokes
- [x] Finish-reviewed twice against the direction contract; DESIGN.md + `.impeccable/design.json` sidecar kept current through every later change

### Brush & tool system ✅ (user-specified mid-session, fully built)
13 tools total — 12 draw-mode brush textures plus Erase, each with genuinely distinct rendering (verified via pixel sampling, not just code review):

| Category | Brushes |
|---|---|
| Basic | Brush, Pencil, Marker, Highlighter, Calligraphy, Pixel, Erase |
| Artistic | Watercolor, Oil Paint, Chalk, Charcoal |
| Effects | Glitter, Neon Glow |

- [x] `brushType` + `opacity` fields threaded through Convex schema, validation, StrokeBuffer, and every render call — remote clients render the *same* texture the drawer picked, not a generic line
- [x] Deterministic per-point hashing (not `Math.random`) for grain/scatter, so redraws don't flicker
- [x] Explicit **Pan** tool (not just space-drag/pinch) for touch/mouse users who'd rather not learn gestures
- [x] **Magnifier** tool: a hover-only circular loupe that shows a zoomed-in crop of the wall around the cursor, without moving the actual camera — for inspecting brush texture up close
- [x] **Shapes** tool: Line/Square/Circle/Triangle, drag a bounding box to commit a clean outline stroke (reuses the existing stroke pipeline — a shape is just a generated point path)
- [x] **Ruler** tool: drag between two points to read the distance in world px as a dashed line + label — an inspection overlay only, never added to the shared wall
- [x] Brush picker popover (grouped Basic/Artistic/Effects), Size + Opacity controls, a discoverable rainbow-conic custom color picker
- [x] Live brush cursor: replaces the OS cursor over the canvas with the brush's actual on-screen size/color/shape at current zoom (square for Pixel, ellipse for Calligraphy, dashed for grainy brushes, glow for Neon, sparkle for Glitter, × for Erase) — so anyone can see exactly how much of the wall their next stroke affects before committing
- [x] Toolbar: collapsible (side rivets shrink it to the tool row) and fully hideable (top chevron, with a pull-tab to bring it back) — two independent controls

### Testing ✅
- [x] Vitest unit tests for `lib/camera.ts` and `lib/coordinates.ts` (pan/zoom math, clamping, screen↔world inverse relationship) — 22 tests
- [x] Convex function tests via `convex-test` (`convex/strokes.test.ts`) — validation boundaries, retry idempotency, gapless/duplicate-free sequencing (sequential and concurrent), `listSince` pagination/ordering (including draw-before-erase), `listRecent` live-tail ordering — 17 tests

### Known gaps (see README §8 for full detail)
- Live updates now catch up from the last applied server sequence after a network stall
- Full-history replay on load, dev-capped at 20,000 strokes — no snapshot system yet
- Presence/online-count queries don't scale past ~hundreds of concurrent users
- No rate limiting beyond input validation
- No accounts, no moderation — by design for V1

---

## V2 — Product Quality ✅ shipped

Goal: make it feel like a real product, not a tech demo. Still Next.js + Convex, no Durable Objects yet.

- [x] **Snapshot system** — rendered snapshot + "strokes since snapshot," removing the full-replay cost as history grows (the #1 scaling wall right now)
- [x] **Cursor-based live catch-up** replacing the fixed-window live tail, so reconnects after a longer gap don't need a full reload
- [x] **Viewport URLs** (`?x=&y=&z=`) — deep links + a share button
- [x] **Historical replay & Time Travel** — floating scrubber UI with play/pause, step backward/forward, speed options (1x, 5x, 20x, 100x), and live return
- [x] **Heatmap of drawing activity** — toggleable translucent overlay, built client-side from strokes already loaded (no separate backend aggregation) bucketed into a 32x32 world grid
- [x] **Mini-map overview** — fixed-size corner panel showing the whole wall, a rectangle marking the current viewport, click/drag to jump the camera there
- [x] **Spatial location discovery & teleportation** — "EXPLORE" menu with Busiest Hotspot, Latest Activity, and Random Art Spot camera teleportation
- [x] **Performance** — canvas state stays out of React re-renders, incremental drawing (already true for V1's architecture — extended for V2 data volume)

## V3 — Spatially Tiled Canvas ✅ shipped

Goal: stop treating the whole world as one monolithic subscription.

- [x] Divide the world into 500×500 spatial tiles (`lib/tiling.ts`), indexed into a 20×20 grid (400 tiles)
- [x] Viewport-bounded subscriptions & culling (`listByTiles` and viewport tile culling for 60 FPS performance)
- [x] Real-time spatial tile status badge (`TILES: N/400`) in top header bar
- [x] Spatial discovery camera teleportation (Busiest Hotspot, Latest Activity, Random Art Spot with active cell exclusion)

## V4 — Dedicated Realtime Infrastructure ⏳ not started

Goal: move high-frequency drawing traffic off Convex, *if* real traffic justifies it. Convex stays as the application backend regardless.

- [ ] Cloudflare Workers + Durable Objects, one coordinator per tile (or tile group)
- [ ] Native WebSocket protocol (subscribe/unsubscribe/stroke/cursor/ping-pong) replacing Convex for raw drawing traffic
- [ ] Reconnection via `lastSequenceByTile`
- [ ] Presence/cursors move off Convex writes entirely
- [ ] Convex narrows to: users, bookmarks, discovery metadata, moderation, analytics, snapshot pointers

## V5 — Global Distributed Canvas ⏳ not started

Goal: an effectively infinite, persistent world.

- [ ] Chunk-based world coordinates, tiles created on demand
- [ ] Multi-resolution tile pyramid for low-zoom rendering (don't render millions of strokes at once)
- [ ] CDN-delivered snapshot tiles (Cloudflare R2 + CDN); WebSockets carry only recent deltas
- [ ] Global/regional historical replay ("watch the last 24 hours of humanity drawing")
- [ ] Discovery layer: trending regions, oldest untouched area, random teleport, daily highlights
- [ ] Optional accounts (contribution history, saved places) — anonymous drawing stays possible
- [ ] Moderation for illegal content only — never region ownership or protection
- [ ] Safety infrastructure: bot detection, abuse fingerprinting, rate limiting, emergency read-only mode

---

## Backlog / TODO

Near-term, concrete, not tied to a specific numbered version:

- [x] Verify production deployment — live at https://alwaysdraw.alwaysdraw.workers.dev/, `npm run smoke:production` passes, existing history replays correctly. Still open: exact deployed Git commit / Convex production deployment name / rollback target aren't recorded (see `DEPLOYMENT.md`) — Cloudflare's GitHub integration builds outside this repo, so these need recording by hand each release
- [x] Automated tests for stroke sequencing, replay ordering, and Convex `strokes.submit` validation
- [x] Scale online-count reads with a cron-maintained singleton; remote cursor fan-out remains intentionally capped
- [x] Cursor-based live catch-up shipped with sequence-cursor coverage
- [x] Activate Sentry with a real project key and verify receipt — `NEXT_PUBLIC_SENTRY_DSN` set, confirmed locally: the example page's frontend + backend test errors both sent real envelopes to the configured project (`sentry.javascript.nextjs/10.69.0`), matching SDK version installed. Not yet reverified on the production Cloudflare deployment specifically (same build-time-env-var caveat — needs a fresh build there too).
- [ ] Activate PostHog with a real project key — deliberately deferred, not scheduled yet
- [x] Public-write guardrails: bounded identifiers, per-client/global fixed-window limits for strokes and presence, and an `ALWAYSDRAW_READ_ONLY=1` incident switch
- [x] Browser smoke coverage for desktop/mobile plus an opt-in, non-production two-browser synchronization/reload test

Nothing else from this session's conversation is outstanding — every explicit ask (eraser fix, bigger canvas, light theme, 13 brushes, Pan/Zoom tools, opacity, custom color picker, legibility fixes, collapsible/hideable toolbar, live brush cursor) has been built, verified live, and committed.
