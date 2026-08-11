# Deployment Record

Deployment is not verified by source code alone. Complete this record for every production release before marking the roadmap deployment item complete.

## Current production release

- Public URL: **https://alwaysdraw.com/** (custom domain — superseded the earlier `alwaysdraw.alwaysdraw.workers.dev` `.workers.dev` default; Cloudflare Workers via OpenNext, deployed through Cloudflare's dashboard Git integration — no `wrangler.jsonc` in this repo by design, build/deploy config lives in the Cloudflare dashboard, confirmed via the `x-opennext: 1` response header)
- Git commit: still not confirmed — Cloudflare's Git integration builds from `origin/main` on push; not independently verifiable from this checkout
- Convex production deployment: **`intent-dove-612`** (`https://intent-dove-612.convex.cloud`) — confirmed via the Convex MCP `status` tool. Read-only from this checkout by design (production writes require an explicit override flag this session never used).
- Cloudflare Worker/version: not recorded
- Migration/schema version: not recorded
- Released at / by: not recorded
- **Known-broken right now**: `/api/geo` and `/api/og` both return HTTP 500 in production as of this check (curl'd directly), from a `runtime = "edge"` directive that's fatal under OpenNext/Cloudflare — this is why country flags render white in prod. The fix is committed to `main` locally but **production has not been redeployed since** — this is the single most important pending action, more urgent than anything else in this file.
- Smoke result: stale — the PASS recorded previously was against the old `.workers.dev` URL, before the domain move and before the edge-runtime bug above was found. Needs a fresh `ALWAYSDRAW_SMOKE_URL=https://alwaysdraw.com npm run smoke:production` run after the next deploy.
- Rollback target: not recorded
- **Sentry/PostHog: not reverified since the domain move** — the last check (against the old `.workers.dev` URL) found neither active despite `NEXT_PUBLIC_SENTRY_DSN` being set locally, attributed to build-time env var timing. Needs reverification against `https://alwaysdraw.com/` after the next deploy, alongside the edge-runtime fix above.

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
