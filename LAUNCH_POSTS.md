# Launch Posts

Ready-to-post drafts for the channels in [DISTRIBUTION.md](DISTRIBUTION.md)'s launch list. Written by Claude, not yet reviewed or posted — read each one before it goes anywhere. Every channel here is **one-shot** per DISTRIBUTION.md's own guardrail: no reposting the same pitch to the same place twice, and no cross-posting the identical text to multiple subreddits back-to-back (reads as spam, and several of these communities actively filter for it).

No user counts, testimonials, or press are claimed anywhere below — there aren't any yet. Update these with real numbers only once real numbers exist.

Swap `https://alwaysdraw.com` for the actual live URL if it differs at post time.

---

## Hacker News — Show HN

**Title:**
Show HN: AlwaysDraw – A permanent, shared 20,000×20,000 canvas the whole internet draws on

**Body:**
AlwaysDraw is a single canvas shared by everyone on the internet, live, permanently. No rooms, no accounts, no ownership, no reset — open the link and you're drawing on the same wall as everyone else, right now, with no onboarding step in between.

I built it because r/place was the closest thing I'd seen to a genuinely shared internet space — but it always ends. I wanted that "someone else is drawing right next to you, right now" feeling to just stay.

A few things that might be interesting architecture-wise:
- Real-time sync via Convex — every stroke is a mutation, and clients subscribe to tile-scoped reactive queries, so an edit on the far side of a 20k×20k world doesn't re-render everyone's viewport.
- Full append-only history — every stroke ever drawn is replayable, with a time-travel scrubber to watch any region evolve.
- No accounts — presence (live cursors, who's drawing where) is scoped per visible tile so it doesn't fan out to every connected client.

Live: https://alwaysdraw.com

Would love feedback, especially anything that breaks under load — this'll be the first real traffic it's seen.

---

## Reddit — r/InternetIsBeautiful

**Title:**
AlwaysDraw: a single 20,000×20,000 shared canvas the whole internet draws on together, live, forever

**Body:**
One world. One canvas. Always drawing.

AlwaysDraw is one shared drawing wall — the whole internet, at once, in real time. No rooms, no accounts, no login, nothing to set up. You open the link and you're already drawing next to whoever else happens to be there right now.

It's the same idea as r/place, except it never ends and never resets. Anyone can draw, erase, or paint over anyone else's work, forever, on a wall that's 20,000×20,000 pixels — big enough that most of it hasn't been touched yet.

Zoom out and you'll see a minimap of everything drawn so far. Zoom in and you might land right next to a stranger mid-stroke.

Live: https://alwaysdraw.com

---

## Reddit — r/webdev and r/SideProject

Adapt this one rather than posting it verbatim to both — change the opening line and which technical detail you lead with so it doesn't read as copy-pasted.

**Title:**
I built a single shared canvas for the entire internet — real-time, permanent, no accounts

**Body:**
Side project I've been building: AlwaysDraw, a single public drawing canvas shared by literally everyone who visits, live, with no rooms or sign-up.

The interesting part for this sub is probably the sync model — it's a 20,000×20,000 world, and I didn't want every client subscribed to the whole thing (that falls over fast). So strokes and presence are both scoped to visible tiles: a client only subscribes to reactive queries for the tiles currently on screen, which keeps the fan-out bounded no matter how much of the wall is being drawn on elsewhere. Built on Next.js + Convex, deployed to Cloudflare Workers.

Everything's append-only, so there's a full replay/time-travel view of how any region of the wall came to look the way it does.

Live: https://alwaysdraw.com — happy to answer questions about the architecture in the comments.

---

## Product Hunt

**Tagline** (≤60 chars):
One canvas. The whole internet. Live, forever.

**Description:**
AlwaysDraw is a single shared drawing canvas for the entire internet — no rooms, no accounts, no reset. Open it and you're drawing next to strangers in real time on a permanent 20,000×20,000 wall. Zoom out to see everything that's been drawn; zoom in to draw right next to someone else, live.

**First comment (post as the maker immediately after launch):**
Hey — maker here. Built this because I wanted the "everyone editing one shared thing at once" feeling from r/place, but permanent instead of a one-time event. No accounts, no ceremony — the link itself is the whole product. Would love to hear what you'd want to see on it next.

---

## Twitter/X — #buildinpublic thread

**1/**
Shipped: AlwaysDraw — one drawing canvas shared by the entire internet, live, permanent, no accounts.

Open the link, you're already drawing next to a stranger. #buildinpublic

**2/**
The pitch is simple: r/place, but it never ends and never resets. One 20,000×20,000 canvas, everyone editing the same object at once, forever.

**3/**
No login, no rooms, no onboarding screen — the link you click *is* the product. First thing you see is the live wall, with real people's cursors moving on it.

**4/**
Built on Next.js + Convex, deployed on Cloudflare Workers. Presence and strokes are scoped per visible tile, so the sync model doesn't fall over as the wall fills up.

**5/**
Live now: https://alwaysdraw.com
Would genuinely love to see what you draw on it.

---

## Not included here — need different prep, not a text post

- **TikTok / Shorts / Instagram Reels** — needs an actual screen-recorded timelapse of a busy canvas region (Time Travel replay feature is built for exactly this), not a written draft.
- **Game directories** (CrazyGames, iogames.space, iogames.onl, MiniPlay, BetaList, 1000Tools) — each has its own submission form (name, short tagline, thumbnail, tags) rather than free-form text; fill per-site when ready.
- **Streamer/creator outreach** — needs a personalized message per streamer, not a broadcast post; hold until the wall has enough happening to be watchable unprompted (per DISTRIBUTION.md's Retention section).
