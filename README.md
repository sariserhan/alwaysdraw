# AlwaysDraw — Version 1 (Functional MVP)

One world. One canvas. Always drawing.

A single public 10,000×10,000 drawing canvas shared by everyone on the internet. No rooms, no accounts, no ownership, no undo. Anyone can draw, erase, or paint over anyone else, in real time, with 12 distinct brush textures (Basic/Artistic/Effects) plus explicit Pan and Zoom tools for touch users.

## 1. Architecture summary

```
Browser (Next.js App Router, client-only canvas component)
  │
  ├─ Local-first drawing: pointer input is drawn to the <canvas> immediately,
  │  never blocked on the network.
  │
  ├─ Two stacked canvases: a static world layer (concrete fill) beneath a
  │  transparent strokes layer, so erasing (destination-out) reveals the
  │  wall, not a hole through to the page background.
  │
  ├─ lib/brushes.ts dispatches each stroke to one of 12 brush renderers
  │  (Basic: Brush/Pencil/Marker/Highlighter/Calligraphy/Pixel; Artistic:
  │  Watercolor/Oil Paint/Chalk/Charcoal; Effects: Glitter/Neon Glow) keyed
  │  by the stroke's brushType — same renderer runs for local and remote
  │  strokes, so everyone sees the same texture. Deterministic per-point
  │  hashing (not Math.random) drives grain/scatter so redraws don't flicker.
  │
  ├─ StrokeBuffer batches points from one drag into ~40-point chunks, flushed
  │  every ~40ms, each chunk submitted as its own Convex mutation.
  │
  └─ Convex (reactive backend)
       ├─ strokes table — every draw/erase chunk (+ brushType, opacity),
       │  server-sequenced, append-only
       ├─ canvasMetadata — singleton holding the global sequence counter
       └─ presence table — one row per anonymous client, heartbeat every 5s

Sync model:
  - On mount: page a full history via strokes.listSince(afterSequence) until
    caught up, replay it once onto the canvas (dev-capped at 20,000 strokes).
  - Live tail: a reactive useQuery(strokes.listRecent) subscription pushes new
    strokes (yours and everyone else's) as they're committed; the client
    applies whatever it hasn't already drawn, keyed by clientStrokeId.
  - Ordering is authoritative server-side: every mutation increments a single
    global `sequence` counter inside the same transaction that inserts the
    stroke, so render order is never ambiguous even under concurrent writers.
  - Erase is stored as a `mode: "erase"` operation, never a deletion — it's
    rendered with `globalCompositeOperation = "destination-out"`. History is
    append-only; there is no undo.
```

Coordinate math, stroke protocol, rendering, and persistence are kept in separate modules (`lib/camera.ts`, `lib/coordinates.ts`, `lib/drawing.ts`, `lib/strokeBuffer.ts` vs. `convex/*.ts`) specifically so Version 3's spatial tiling can slot in without a rewrite — world coordinates and camera transforms don't know or care how the backend partitions the world.

## 2. Project tree

```
app/
  layout.tsx            root layout, ConvexClientProvider wiring, metadata
  page.tsx               client-only entry (dynamic import, ssr:false — see Known limitations)
  globals.css

components/
  GlobalCanvas.tsx        owns camera, tool state, pointer/touch input, redraw loop
  DrawingToolbar.tsx       tool row (Brush/Erase/Pan/Zoom), brush picker, color, size, opacity, zoom controls
  OnlineCount.tsx
  ConnectionStatus.tsx     live Convex websocket state
  RemoteCursors.tsx
  ThemeToggle.tsx           dark (default) / light theme switch
  ChromeRivet.tsx
  ConvexClientProvider.tsx

lib/
  camera.ts               Camera type, pan/zoom math (pure, unit-testable)
  coordinates.ts           screen<->world conversion, world-bounds clamping
  drawing.ts               canvas draw calls (plain stroke, erase, world background)
  brushes.ts                12 brush renderers (Basic/Artistic/Effects) + BRUSH_CATALOG
  strokeBuffer.ts           batches pointer points into ~40pt chunks every ~40ms
  identity.ts               anonymous clientId in localStorage
  types.ts

convex/
  schema.ts               strokes / canvasMetadata / presence tables + indexes
  constants.ts              shared world-bounds & validation limits
  strokes.ts                submit (validated, sequenced, idempotent), listSince, listRecent
  presence.ts                heartbeat, list, onlineCount, clearStale (cron target)
  canvas.ts                  getMetadata
  crons.ts                   1-minute stale-presence sweep
```

## 3. Local development

```bash
npm install
npx convex dev     # in one terminal — pushes convex/ functions, keeps them live
npm run dev         # in another terminal — Next.js on http://localhost:3000
```

Open `http://localhost:3000` — it opens directly into the canvas, no login, no homepage.

## 4. Convex setup

Already provisioned for this repo (dev deployment `sariserhan:alwaysdraw:dev/serhan`). To set up a new deployment from scratch:

```bash
npx convex dev --once --configure=new --project alwaysdraw
```

This writes `.env.local` with the deployment's connection info and pushes `convex/schema.ts` + functions. Re-run `npx convex dev` (no flags) during development to keep functions live-reloading.

## 5. Required environment variables

`.env.local` (gitignored, generated by `npx convex dev`):

```
CONVEX_DEPLOYMENT=dev:<your-deployment-name>
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
```

No other secrets are required for V1 (no auth, no third-party APIs).

## 6. Deployment instructions

**Convex (backend):**
```bash
npx convex deploy   # pushes convex/ to your production deployment
```

**Next.js (frontend), on Cloudflare Workers (via OpenNext):**

Cloudflare doesn't run Next.js natively — the [OpenNext](https://opennext.js.org/cloudflare) adapter (`@opennextjs/cloudflare`) builds this app into a Worker.

1. One-time setup in the repo root:
   ```bash
   npx @opennextjs/cloudflare migrate
   ```
   This installs `@opennextjs/cloudflare`, adds `wrangler.jsonc` (Worker config: `main: ".open-next/worker.js"`, `assets: ".open-next/assets"`, `nodejs_compat` flag) and `open-next.config.ts`, and adds `preview`/`deploy`/`upload` scripts to `package.json`.
2. Set `NEXT_PUBLIC_CONVEX_URL` (and `NEXT_PUBLIC_CONVEX_SITE_URL`) as Worker environment variables — in `wrangler.jsonc`'s `vars` block for non-secret values, or via `npx wrangler secret put NEXT_PUBLIC_CONVEX_URL` — to your **production** Convex deployment's URL (from `npx convex deploy` output or the Convex dashboard), not the dev URL. These are `NEXT_PUBLIC_*` values baked in at build time, so they must be set before the build/deploy step below.
3. Build + deploy:
   ```bash
   npx @opennextjs/cloudflare build
   npx @opennextjs/cloudflare deploy
   ```
   (Or `npx wrangler login` first if this is the first deploy from this machine.) The Worker's `*.workers.dev` URL — or a custom domain attached in the Cloudflare dashboard — opens directly into the canvas.

## 7. Testing instructions

```bash
npm test          # runs lib/*.test.ts once (Vitest)
npm run test:watch
```

Unit tests cover the pure math the spec calls out — camera pan/zoom/clamping (`lib/camera.test.ts`) and screen↔world coordinate conversion (`lib/coordinates.test.ts`), including that `screenToWorld`/`worldToScreen` are true inverses and that `zoomAt` keeps the world point under the cursor fixed.

Convex function tests (`convex/strokes.test.ts`, via [convex-test](https://github.com/get-convex/convex-test)) cover `strokes.submit`'s abuse-boundary validation (width/point-count/coordinate/color/opacity limits, rejected at the boundary and accepted just inside it), retry idempotency on a repeated `clientStrokeId`, gapless/duplicate-free sequence numbering under both sequential and concurrent submits, `listSince` pagination and ordering (including that an erase reliably lands after the draw it erases), and `listRecent`'s live-tail ordering.

Manual verification performed for this build:

- Two browser sessions, same page: draw in A → appears in B within ~1s; erase in B over A's stroke → A updates live.
- Reload mid-session: full history replays correctly (session B loaded fresh and saw session A's prior stroke).
- Pan (space+drag), wheel-zoom (focal-point correct), 2-finger touch pinch-zoom + pan, and the toolbar's zoom/reset buttons all verified via synthetic pointer/wheel events.
- Mobile viewport (390×844): toolbar wraps and remains usable; touch drawing and pinch both work.
- `npx tsc --noEmit`, `npx eslint .`, and `npm test` are all clean.

To repeat the two-browser check by hand: open `http://localhost:3000` in two windows and draw in both.

## 8. Known limitations

- **Live-tail window, not true cursor-based catch-up**: the reactive subscription (`strokes.listRecent`) returns the most recent 300 strokes. A client that's open but network-stalled for long enough to miss more than 300 strokes will only fully catch up on next reload (which does a full replay). Fine at V1 traffic; V2's snapshot system removes this ceiling.
- **Full-history replay on every load**, capped at 20,000 strokes (dev safety valve, not a real limit) — gets expensive as history grows. This is explicitly deferred to V2 (snapshots) per the spec.
- **`onlineCount`/presence `list`/stale cleanup** use `.collect()`/`.take()` over an index range rather than a running counter — fine at hundreds of concurrent users, not thousands.
- **No rate limiting beyond input validation** (width/point-count/coordinate/color bounds, 100 pts/mutation). A malicious client could still spam many small mutations; acceptable for V1 per spec ("add reasonable limits if practical"), worth hardening before real public traffic.
- **`app/page.tsx` opts the canvas out of SSR** (`next/dynamic(..., { ssr: false })`). The app is one imperative `<canvas>` plus entirely browser-only state (camera, websocket, anonymous identity in `localStorage`) — server-rendering it added nothing and only produced hydration mismatches, so it's skipped outright. This means the very first paint is a client-side render (brief blank/loading frame), not server-rendered HTML.
- **No accounts, no moderation** — by design for V1, per spec.

## 9. Performance notes

- Local drawing never waits on the network: pointer moves draw an incremental line segment directly, independent of the ~40ms/40-point batch flush to Convex.
- Camera state lives in a `ref`, not React state, so panning/zooming don't trigger React re-renders — only a `requestAnimationFrame`-throttled full canvas redraw plus a lightweight state sync (zoom %, cursor overlay) once per frame.
- New remote strokes are drawn incrementally on top of the existing canvas bitmap (no full history redraw) except when the camera itself changes, which inherently requires repainting every visible stroke at the new transform.
- Each stroke document caps at 100 points and each mutation is independently validated and sequenced — no unbounded payloads.

## 10. Recommendations for Version 2

Per the spec, in priority order:
1. **Snapshot system** — the full-replay-on-load cost is the first real scaling wall; a periodic rendered snapshot + "strokes since snapshot" would remove the 20k-stroke dev cap entirely.
2. **Cursor-based live catch-up** replacing the fixed 300-stroke `listRecent` window, so reconnects after a longer gap don't require a full reload to catch up.
3. **Viewport URLs** (`?x=&y=&z=`) — small, high-value, and it's the one V2 feature that's nearly free given `lib/coordinates.ts` already isolates the camera math.
4. **Heatmap / mini-map** — needs the presence/stroke data already being collected; mostly a new read-side aggregation, not a data model change.
5. Everything else in the spec's V2 list (replay/time-travel, featured locations) builds on #1 and #2, so sequencing them after snapshots exist will be significantly less work than building them against the current full-replay model.
