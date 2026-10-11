# Deployment Record

Deployment is not verified by source code alone. Complete this record for every production release before marking the roadmap deployment item complete.

## Current production release

- Public URL: **https://alwaysdraw.com/**
- Application source commit: **`33ea13c`**
- Released: **2026-10-11**, via the existing OpenNext/Cloudflare Worker deployment.
- Cloudflare Worker: **`alwaysdraw`**, version **`0cc4f2df-098b-4242-b70e-70aee760da29`**.
- Convex production deployment: **`intent-dove-612`** (`https://intent-dove-612.convex.cloud`). Functions and the new `strokes.by_deleted_and_sequence` / `boardStrokes.by_deleted_and_sequence` indexes deployed successfully.
- Fix: the previous browser bundle attempted to connect to `127.0.0.1:3210`. The production deploy/upload scripts now explicitly set the production public Convex URLs before building, overriding local development settings in `.env.local`.
- Initial loading reads surviving strokes via the new indexes, in four concurrent workers, composes privately, catches up on changes, then reveals the wall. Tombstones remain available to catch-up/live queries. The compatible legacy fallback, request timeouts, and loading progress remain in place.
- Validation: 291 unit/backend tests passed; TypeScript, targeted lint, Next/OpenNext build, Wrangler dry run, and desktop/mobile smoke tests passed. The public-site smoke test passed initial loading, reload, toolbar interaction, and Sketchbook navigation.
- Public browser verification: desktop 1280×900 and mobile 390×844 rendered nonempty artwork, used the production Convex WebSocket, and had no page runtime errors. Observed initial-load times were 19.8s and 6.5s respectively; these are individual unthrottled checks, not performance guarantees.
- Remaining limitation: first visits still transfer surviving stroke data (133,344 strokes at verification time); flattened raster snapshot loading is not implemented. Live drawing/erasing was not exercised on production to avoid adding test artwork.
- Telemetry and unrelated endpoints were not re-audited in this release.

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
