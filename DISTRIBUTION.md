# Distribution

How AlwaysDraw gets its first real traffic, and how it keeps people coming back. See [PRODUCT.md](PRODUCT.md) for positioning/voice and [ROADMAP.md](ROADMAP.md) for what's actually shipped — this file is about *reach*, not *what to build*. Nothing here has been executed yet; no user counts, press, or testimonials exist to report (see PRODUCT.md's "Evidence on Hand" — don't fabricate any here either, update this file with real numbers once there are real numbers).

Status shorthand: ✅ done · 🚧 in progress · ⏳ planned, not started.

---

## The pitch

**"One world. One canvas. Always drawing."** The thing to lead with in any post/launch copy: this isn't a drawing tool, it's one object the whole internet edits together, permanently, with no rooms and no ownership (r/place, but it never ends and never resets). The honest hook is *"open this link, someone you've never met might be drawing right next to you, right now."*

---

## Technical SEO Foundation ✅ done

The app's technical SEO architecture is fully implemented to maximize search engine indexing and social link preview engagement:

- ✅ **Dynamic OpenGraph Social Card Generator**: [`app/api/og/route.tsx`](app/api/og/route.tsx) generates dynamic social share preview cards complete with coordinate badges for deep-linked canvas spots (`?x=...&y=...&z=...`).
- ✅ **Comprehensive OpenGraph & Twitter Metadata**: Configured in [`app/layout.tsx`](app/layout.tsx) with canonical URLs, title templates (`AlwaysDraw — The World's Shared Real-Time Canvas`), meta descriptions, keywords, author tags, and `summary_large_image` Twitter cards.
- ✅ **Structured Data (JSON-LD)**: Implemented `Schema.org/WebApplication` microdata embedded in layout head for rich snippet discovery.
- ✅ **Search Engine Crawler Control**: Automated [`sitemap.ts`](app/sitemap.ts) (`/sitemap.xml`) and [`robots.ts`](app/robots.ts) files for search engine indexing.
- ✅ **Core Web Vitals Performance Tracking**: Integrated [`components/WebVitals.tsx`](components/WebVitals.tsx) for monitoring LCP, INP, CLS, and TTFB.

### Production Domain & Search Console Steps ⏳ planned
- [ ] **Custom Domain Deployment**: Deploy to a custom root domain (`alwaysdraw.com` or `alwaysdraw.io`) instead of `.workers.dev`. Custom root domains hold significantly higher domain authority and rank higher in Google/Bing search queries.
- [ ] **Search Console Submission**: Submit `https://your-domain.com/sitemap.xml` directly to Google Search Console and Bing Webmaster Tools for immediate indexing.

---

## Launch channels ⏳ not started

Concrete, one-shot posts to specific communities — do these once the product is stable enough to survive a traffic spike, not before.

- [ ] **Reddit Launch**:
  - `r/InternetIsBeautiful` — Pitch: *"AlwaysDraw: A single 20,000x20,000 shared real-time drawing canvas for the internet"*. (High-potential channel for driving 50,000+ instant visitors).
  - Art & Dev Subreddits: `r/webdev`, `r/SideProject`, `r/PixelArt`, `r/drawing`, `r/WebGames` (r/place nostalgia is a natural comparison point).
- [ ] **Hacker News "Show HN"**: Technical audience will care about the real-time sync architecture (Convex, append-only history, live tail) as much as the canvas itself; lead with the live link, not a static screenshot.
- [ ] **Product Hunt Launch**: Full Product Hunt product launch with short interactive preview clips.
- [ ] **Social Media Video Snippets (TikTok / Shorts / Instagram Reels)**: 10-15s time-lapse recordings of busy canvas areas being built or transformed in real-time.
- [ ] **Web & .io Game Directories**: Submit to **CrazyGames**, **iogames.space**, **iogames.onl**, **MiniPlay**, **BetaList**, and **1000Tools**.
- [ ] **Twitter/X**: #buildinpublic thread showing the live canvas with viewport coordinate deep-links.
- [ ] **Community & Creator Outreach**: Partner with Twitch / YouTube streamers for live interactive viewer sessions.

---

## Growth loops that use features already built ⏳ not started

The product already has mechanics that generate their own shareable content — use them instead of inventing new marketing surfaces.

- [ ] **Viewport deep links** (`?x=&y=&z=`, shipped in V2) — every "look what I drew" share is a real link back into the live canvas at that exact spot, not a screenshot. This is the core loop: someone shares a link, a visitor lands inside the live product immediately (matches the "no homepage, no onboarding" principle — the shared link *is* the onboarding).
- [ ] **Time Travel replay** (shipped in V2) — record a scrubbed playback of a busy region as a screen-capture timelapse for TikTok/YouTube Shorts/X. "Watch 6 hours of strangers drawing over each other" is a format that doesn't need AlwaysDraw-specific context to land.
- [ ] **Heatmap + Explore/hotspot teleport** (shipped in V2/V3) — surfaces where things are actually happening, useful both as a feature to show off in launch posts ("here's where the internet is drawing right now") and as a way to route new visitors somewhere alive instead of an empty patch of wall.
- [ ] **Bookmarks** (shipped) — a lightweight "save this spot" mechanic that could become a public gallery of noteworthy spots once there's enough content to curate.

---

## Retention ⏳ not started, mostly blocked on V6 auth

- [ ] Return-visit hook: notify a user when someone draws near a spot they bookmarked or previously drew in — needs real accounts (ROADMAP V6), not buildable on the current anonymous `clientId` model
- [ ] Streamer/creator outreach once the canvas has enough going on to be watchable for more than a minute unprompted — cold outreach before then would just be asking someone to feature an empty wall

---

## Monetization-driven distribution ⏳ blocked on V6, deliberately deferred

Cross-references ROADMAP.md's V6 section — don't start any of this before V6 ships, and don't chase sponsors before there's real traffic to offer them.

- [ ] Sponsor/branded murals — a paid, protected zone (V6) is itself a distribution surface once a sponsor has a reason to point their own audience at their spot on the wall
- [ ] "Rent a zone" self-serve flow (V6) doubles as acquisition — someone renting space to advertise their own project brings their own audience in

---

## Guardrails

- Never report or imply user counts, press coverage, or testimonials that haven't actually happened — PRODUCT.md is explicit that none exist yet, and that applies here too.
- Don't inflate the online-presence count or seed the wall with fake/bot strokes to look busier than it is — the product's whole pitch is "real strangers, right now"; faking that is the one thing that would make the pitch untrue.
- Launch channels are one-shot — don't repost the same "Show HN"/Product Hunt pitch after it's been done once.
