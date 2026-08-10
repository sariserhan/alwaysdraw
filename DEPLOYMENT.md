# Deployment Record

Deployment is not verified by source code alone. Complete this record for every production release before marking the roadmap deployment item complete.

## Current production release

- Public URL: not recorded
- Git commit: not recorded
- Convex production deployment: not recorded
- Cloudflare Worker/version: not recorded
- Migration/schema version: not recorded
- Released at: not recorded
- Released by: not recorded
- Smoke result: not recorded
- Rollback target: not recorded

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
