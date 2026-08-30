# AlwaysDraw Launch Plan — Organic Growth

Goal: bring in real traffic (~1000 users) with zero ad spend, using community posts. This is a one-shot-per-community game — each post below is spaced out on a different day, not all fired at once.

## Order of operations

1. r/InternetIsBeautiful
2. r/SideProject (a few days later)
3. Show HN (a few days after that)

Never post the same link to multiple communities on the same day — cross-posting identical links same-day reads as spam to Reddit's own filters, not just to human moderators.

---

## 1. r/InternetIsBeautiful

**Culture:** third-person "here's a cool site" framing — not "I made this." Direct self-promotion reads badly here.

**Rules to know before posting:**
- **90/10 rule**: if your account looks like it exists only to promote your own stuff, the post gets removed on sight. If your account is brand new or has little history, spend a little time genuinely commenting/participating elsewhere on Reddit first.
- Submissions can't have "primary content produced by AI." This is aimed at AI-content-generator sites (art generators, GPT wrappers) — AlwaysDraw's actual function is real-time *human* drawing, so this shouldn't apply. Just don't frame the post around how it was built.
- Exact karma/account-age minimums aren't publicly documented and vary — if AutoMod removes the post, it'll tell you why. That's normal, not a ban; you can fix and repost.

**Post type:** Link post (submit the URL directly), title only — no body text, no "check it out!"

**Title to use:**
> A single shared canvas the whole internet draws on together, live

---

## 2. r/SideProject

**Culture:** first-person "I built X" is expected and welcomed here — opposite framing from InternetIsBeautiful.

**Post type:** Link post + 1-2 sentences of body text.

**Title to use:**
> I built a live shared canvas that anyone on the internet can draw on together in real time

**Body text to use:**
> No sign-up, just open it and start drawing with whoever else is there. Would love feedback.

---

## 3. Show HN

URL: https://news.ycombinator.com/showhn.html

**Culture:** more technical/skeptical audience than Reddit. Has its own submission guidelines — read them before posting.

**Title to use:**
> Show HN: AlwaysDraw – a shared canvas anyone on the internet can draw on, live

---

## How to post (applies to all three)

1. **Post the direct link**, not a screenshot or text post — these communities want to click through to the live site.
2. **Timing**: weekday mornings, roughly 8–10am US Eastern/Pacific. That's when both traffic and moderator attention are highest.
3. **Be online for the first 1-2 hours after posting.** Reply to every comment. Early engagement is what Reddit's and HN's ranking algorithms reward, and it's also just good etiquette.
4. **Never ask for upvotes.** Never reply defensively to criticism. Both communities punish this hard and it can tank the post.
5. **One community at a time**, spaced across different days (see "Order of operations" above).

## Before posting: technical readiness check

Worth doing before the first post goes out, not after:
- Confirm the "X online" presence count and canvas hold up under a sudden crowd of concurrent users.
- Confirm Convex rate limits (per-client and global) are tuned for a traffic spike, not just steady-state usage.
- Make sure all pending fixes are actually deployed to production (`npx convex deploy` + `npm run deploy`) before driving new traffic to the site.
