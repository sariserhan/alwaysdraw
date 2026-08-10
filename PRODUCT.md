# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone who opens the site — no accounts, no segmentation, no roles. The product is explicitly for "everyone on the internet" simultaneously: strangers who have never met, drawing on the same surface at the same time. There is no primary persona beyond "a person with a browser tab open." Their job on the surface is whatever they choose: draw, doodle, write, collaboratively build something, paint over someone else's work, or deliberately destroy it.

## Product Purpose

AlwaysDraw is one single public drawing canvas shared by everyone on the internet, permanently. Opening the root URL drops the visitor directly into the live shared canvas — no homepage, no onboarding, no login. Success is the experience feeling alive and consequential: two or more strangers can open the same page, draw simultaneously, and alter each other's work in real time, close to instantly.

## Positioning

Not a drawing tool — a single public object that everyone can continuously change. The mechanism a neighboring product (a private whiteboard, a multiplayer art tool with rooms/layers/ownership) could not truthfully copy: there are no rooms, no private canvases, no protected regions, no ownership of any area, no turns, no time limits, no requirement to preserve anyone else's work, and no moderation mechanic that prevents users from painting over each other. Painting over, erasing, and restoring other people's work is the product, not a bug to be designed away.

## Operating Context

- Root URL opens directly into the canvas — desktop and mobile web, no app install.
- Desktop input: left-drag to draw, mouse wheel to zoom, space+drag to pan.
- Mobile input: one finger draws, two fingers pan/pinch-zoom.
- The canvas is a fixed 5,000×5,000 logical-pixel world (V1); a viewport-sized `<canvas>` renders it via a camera (position + zoom), not a giant DOM element.
- History is append-only and permanent: erasing is stored as an operation, not a deletion, and there is no undo of anything already published to the shared canvas.
- No moderation mechanics gate drawing in V1; abuse controls are limited to input validation and rate limits (brush width, point count, coordinate bounds, color format), not content review.

## Capabilities and Constraints

- Anonymous identity only (`anon-XXXXXX`, generated client-side and stored in `localStorage`) — convenience, not authentication. No accounts in V1.
- Real-time multi-user sync: any client's draw/erase strokes must appear for other connected clients close to instantly, with server-assigned sequence numbers as the authoritative order (never client timestamps).
- Reload must reconstruct the full shared canvas state, not just the current session's local strokes.
- Present online-user count is approximate (presence heartbeat + staleness window), not exact.
- Current stack (already in place, not an open decision): Next.js (App Router) + TypeScript + Tailwind CSS + native HTML5 Canvas + Convex, no Durable Objects/custom WebSocket infra/Yjs/CRDTs/Redis/Kafka/Fabric.js/Konva.js at this stage.
- Explicitly undecided / deferred, not to be designed against yet: accounts, moderation UI, spatial tiling of the world, snapshot-based history/replay/time-travel, heatmaps, mini-map, viewport deep links, monetization surfaces. These belong to later versions (V2–V5) per the product roadmap and should not be assumed present.

## Brand Commitments

- Name: **AlwaysDraw**.
- Tagline: **"One world. One canvas. Always drawing."**
- Visual identity (palette, typography, component language) is not yet defined — no DESIGN.md exists.

## Evidence on Hand

No real user content, testimonials, case studies, or press exist yet — this is a pre-launch build. No custom brand assets (logo, imagery) exist yet; `public/` only has the default Next.js starter icons. Future work must not fabricate usage stats, testimonials, or user counts.

## Product Principles

1. **Immediacy over ceremony.** No homepage, no onboarding, no login — the root URL is the product. Every design decision should protect that directness.
2. **The canvas is the protagonist.** Chrome (toolbar, status, counts) stays minimal and floating; it never competes with the shared drawing for attention.
3. **Consequence is the feature, not a risk to mitigate.** Anyone can be painted over, erased, or restored by anyone else — the interface should make that feel like the point, not hide or apologize for it.
4. **Live and populated, always.** The product's emotional core is "other people are here right now, changing this with you" — presence, real-time updates, and online counts are core to the experience, not secondary polish.
5. **Design for the version that exists.** V1 is a single global, un-tiled, un-moderated canvas with no accounts — do not design UI for capabilities (rooms, moderation queues, profiles, tiling) that don't exist yet.

## Accessibility & Inclusion

No product-specific accessibility requirement has been established beyond general best practices (keyboard operability where feasible, sufficient color contrast for UI chrome, standard screen-reader semantics for non-canvas UI). The canvas itself is an inherently visual/freehand medium; no accommodation commitment has been made for non-visual access to canvas content.
