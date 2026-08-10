# Deployment Record

Deployment is not verified by source code alone. Complete this record for every production release before marking the roadmap deployment item complete.

## Current production release

- Public URL: https://alwaysdraw.alwaysdraw.workers.dev/ (Cloudflare Workers, deployed via Cloudflare's GitHub integration — no `wrangler.jsonc` in this repo by design, build/deploy config lives in the Cloudflare dashboard)
- Git commit: not confirmed — Cloudflare's Git integration builds from `origin/main` on push; local `main` was at `14a2d445` (2026-08-10) when this was checked, but the exact commit Cloudflare built from was not independently confirmed
- Convex production deployment: not recorded — not visible from this checkout; record the deployment name from `npx convex deploy` output or the Convex dashboard
- Cloudflare Worker/version: not recorded
- Migration/schema version: not recorded
- Released at: not recorded
- Released by: not recorded
- Smoke result: **PASS** — `npm run smoke:production` against the public URL above: `{"ok":true,"url":"https://alwaysdraw.alwaysdraw.workers.dev/","title":"AlwaysDraw"}` (page loads, wordmark renders, theme toggle present, Pan tool activates, zero browser console errors). Also manually verified: existing canvas history renders (confirms replay against production Convex), header shows live connection status + online count, zoom/reset controls work. Not re-verified: two-browser realtime sync and erase (would require drawing on the real production canvas, which is permanent/append-only — skipped intentionally).
- Rollback target: not recorded
- **Sentry/PostHog: NOT active in this deployment.** Verified via live network/DOM inspection: no requests to `*.sentry.io` or `*.i.posthog.com`, no `window.Sentry`/`window.posthog`. The instrumentation code is correct and already committed, but `NEXT_PUBLIC_SENTRY_DSN`/`NEXT_PUBLIC_POSTHOG_KEY` are build-time-inlined values — if they were added to Cloudflare's environment after the last build, this deployment predates them. Needs a fresh build/deploy, then re-verification.

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
