# Deployment Record

Deployment is not verified by source code alone. Complete this record for every production release before marking the roadmap deployment item complete.

## Current production release

- Public URL: **https://alwaysdraw.com/**
- Application source commit: **`52f05f2`**
- Released: **2026-10-11**, via the existing OpenNext/Cloudflare Worker deployment.
- Cloudflare Worker: **`alwaysdraw`**, version **`e303e89d-c146-42ff-b818-f3049ad479c9`**.
- Convex production deployment: **`intent-dove-612`** (`https://intent-dove-612.convex.cloud`). Functions and the new `strokes.by_deleted_and_sequence` / `boardStrokes.by_deleted_and_sequence` indexes deployed successfully.
- Fix: the previous browser bundle attempted to connect to `127.0.0.1:3210`. The production deploy/upload scripts now explicitly set the production public Convex URLs before building, overriding local development settings in `.env.local`.
- Loading UI: a body-level overlay above canvas chrome, with animated pencil/doodles, stroke counter, reduced-motion support, and a retry action. Progress updates re-render only the overlay, at most ten times per second, instead of the full canvas UI per response. Desktop/mobile stacking, reduced motion, failed-load recovery, and the production smoke test passed.
- Initial loading downloads an immutable gzip file of packed **vectors**, streams its pages into memory, applies newer strokes/deletions through a fresh sequence boundary, then reveals the wall. Original coordinates, authors, brush styles, timestamps, IDs and tile metadata are preserved. This is not a raster image; zoom, hover, replay and export retain their source vectors.
- `buildWallCheckpoint.build` prepares the file in Convex storage. The five-minute cron skips rebuilding unchanged walls. Concurrent builders are locked, publication is atomic, and old files are retained for an hour for in-flight downloads. Checkpoints older than 30 minutes are rejected, safely inside the 24-hour tombstone retention. Incomplete/corrupt/unsupported downloads and overly large catch-up gaps fall back to the existing packed queries.
- Initial production file: **13,088,674 bytes**, **133,344 strokes**, sequence **356,848**. Previous first-load WebSocket traffic was about **48.3 MB** across **154** packed stroke queries. The new path used **one file download**, zero initial packed stroke queries, and about **11 KB** of WebSocket traffic: approximately **73% less initial stroke payload**.
- Full-wall default overview is unchanged. Desktop/mobile screenshots showed the expected artwork, and painted-pixel counts matched the prior path (722,903 / 253,267 pixels respectively).
- Validation: all **304** unit/backend tests passed; TypeScript, full lint (22 existing warnings, zero errors), Next/OpenNext build and desktop/mobile smoke tests passed. The test backend also passed two-browser live draw/erase sync, reload catch-up from an older checkpoint, owner hover, and fallback with the cache download deliberately blocked. Browser plugin was unavailable; checks used Playwright.
- Public browser measurements, unthrottled fresh browser contexts: immediately before this release, desktop **15.9s**, mobile **5.1s**; after, desktop **6.0–6.4s**, mobile **5.0–6.0s**. These are individual observations, not performance guarantees; mobile showed no consistent speedup in these checks. Public smoke passed initial load, reload, toolbar interaction and Sketchbook navigation. Production owner hover was checked at 2× zoom without adding test artwork.
- First production checks logged an intermittent unreachable-resource error; repeated desktop/mobile runs had no console/runtime errors and production smoke passed. The existing VisitorPing request was aborted on page closure. Telemetry ingestion was not re-audited.
- Remaining cost: decoding and rendering the full vector wall still happens on the client. The refresh job reads active stroke pages when the wall has changed; it does not alter the authoritative strokes. Production write/delete checks were kept on the disposable local backend.
- Previous known-good frontend rollback: source `e1a7d68`, Worker `3ad99190-bf6e-4feb-96a9-0a1064f462df`. The checkpoint backend is additive and the previous frontend continues using the packed-query path.

### Production commands

Deploy backend changes first, then rebuild and deploy the frontend:

```sh
CONVEX_DEPLOYMENT=prod:intent-dove-612 npx convex deploy
npm run deploy
ALWAYSDRAW_SMOKE_URL=https://alwaysdraw.com npm run smoke:production
```

`npm run deploy` and `npm run upload` deliberately target the existing production backend. Use `npm run dev` / `npm run preview` for local development. Do not publish an arbitrary local build with a loopback `NEXT_PUBLIC_CONVEX_URL`: Next.js embeds that URL into browser JavaScript at build time.

## Required release gates

1. `npm test`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm run build`
5. `npm run test:e2e`
6. Push Convex functions/schema to the intended production deployment.
7. Build and deploy the frontend with production `NEXT_PUBLIC_CONVEX_URL` values.
8. Verify the public URL in two browser sessions: load, draw, remote sync, erase, and reload reconstruction.
9. Run `ALWAYSDRAW_SMOKE_URL=<public-url> npm run smoke:production` and record its result.
10. Verify Sentry/PostHog receive the expected release and operational events when configured.
11. Record the exact values above, including a known-good rollback commit/Worker version.

The live multiplayer test (`npm run test:e2e:live`) must point at a non-production Convex deployment because the canvas history is append-only.
