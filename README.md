# AlwaysDraw

**One world. One canvas. Always drawing.**

A single public 20,000×20,000 drawing canvas shared in real time by everyone on the internet. Anyone can draw, erase, add vector shapes, type vector text, post sticky notes, or paint with 12 distinct brush textures across an infinite collaborative wall.

> 📖 **Full Features Showcase:** See [FEATURES.md](./FEATURES.md) for a detailed breakdown of all tools, creative features, moderation controls, and keyboard shortcuts.

---

## 🎨 Highlights & Features

- **Real-Time Multiplayer Sync:** Reactive real-time stroke synchronization powered by Convex backend.
- **12 Brush Textures & Custom Colors:** Basic (Brush, Pencil, Marker, Highlighter, Calligraphy, Pixel), Artistic (Watercolor, Oil Paint, Chalk, Charcoal), and Effects (Glitter, Neon Glow) with eyedropper color sampling.
- **Vector Text & Expanded Shapes:** Type vector text in 5 typography styles (Sans, Mono, Pixel, Serif, Script) and draw 8 shape types (Line, Arrow, Rectangle, Circle, Triangle, Star, Hexagon, Heart).
- **Special Creative Tools:** Flood Fill Bucket, Sticker Catalog, Architectural Ruler, Industrial Stencils, and Laser Pointer.
- **Navigation & Exploration:** Smooth focal-point pan & zoom, MiniMap viewport tracker, Activity Heatmap overlay, and Viewport Bookmarks with URL deep-linking.
- **Collaboration & Sticky Notes:** Live remote cursors, country flag indicators, and interactive Sticky Note comment pins.
- **Time-Travel Replay:** Replay wall history stroke-by-stroke with speed controls (1x, 2x, 5x, 10x).
- **Admin Moderation & Mural Shield:** Protected canvas zones to lock community artwork, image stamping, area wipe, client rollback, and live broadcast banners.

---

## 🏗️ 1. Architecture Summary

```
Browser (Next.js App Router, client-only canvas component)
  │
  ├─ Local-First Drawing: Pointer input renders to <canvas> immediately without waiting on network.
  │
  ├─ Dual Stacked Canvases: Static concrete world background beneath a transparent stroke layer,
  │  so erasing (destination-out) reveals the wall texture.
  │
  ├─ lib/brushes.ts: Renders 12 brush textures with deterministic per-point hashing for flicker-free redrawing.
  │
  ├─ lib/strokeBuffer.ts: Batches pointer points into ~40-point chunks, flushed every ~40ms as Convex mutations.
  │
  └─ Convex Reactive Backend
       ├─ strokes table — server-sequenced append-only stroke chunks
       ├─ protectedZones table — admin-locked canvas regions (Mural Shield)
       ├─ broadcasts & presence tables — live banners, cursor positions, and online counts
       └─ snapshots & bookmarks tables — rendered canvas state and saved locations
```

---

## 📁 2. Project Structure

```
app/
  layout.tsx            Root layout, ConvexClientProvider wiring, metadata
  page.tsx              Client-only entry
  globals.css           Design tokens and theme variables

components/
  GlobalCanvas.tsx       Main canvas coordinator (camera, pointer input, tool modes, redraw loop)
  DrawingToolbar.tsx      Toolbar controls (brushes, shapes, text, fill, stickers, color, opacity, zoom)
  ProtectedZonesOverlay.tsx Visual shield overlay for admin-protected canvas areas
  CommentsOverlay.tsx    Interactive sticky note comments overlay
  MiniMap.tsx            MiniMap navigation widget & viewport tracker
  AdminPanelModal.tsx    Admin operations control center & moderation tools
  ReplayBar.tsx          Time-travel history replay controls
  ExploreMenu.tsx & BookmarkMenu.tsx Viewport discovery and saved location bookmarks

lib/
  camera.ts              Camera pan/zoom math & bounds clamping
  coordinates.ts         Screen <-> world coordinate transforms
  drawing.ts             Canvas rendering routines
  brushes.ts             12 brush renderers & catalog
  shapes.ts              8 vector shape generators
  textToPoints.ts        Vector font stroke renderer
  floodFill.ts           Spiral fill point generator
  stickers.ts            Sticker & emoji catalog
  strokeBuffer.ts        Stroke chunk batching & buffer management

convex/
  schema.ts              Database schema definitions
  strokes.ts             Stroke submission (validated, sequenced, idempotent), listSince, listRecent
  admin.ts               Admin passcode verification, protected zones, wipeArea, rollbackClient, telemetry
  presence.ts            Heartbeat, presence list, online counts
  bookmarks.ts           Saved location bookmarks & comments
```

---

## 💻 3. Local Development

```bash
# Install dependencies
npm install

# Terminal 1 — Start Convex dev process
npx convex dev

# Terminal 2 — Start Next.js local dev server
npm run dev
```

Open `http://localhost:3000` to launch directly into the canvas.

---

## 🧪 4. Testing Instructions

```bash
# Run Vitest unit test suite (100 tests across 14 test files)
npm test

# Run Vitest in watch mode
npm run test:watch

# Build production bundle & verify TypeScript compilation
npm run build

# Run Playwright E2E smoke tests
npm run test:e2e

# Run opt-in live two-browser multiplayer E2E test
npm run test:e2e:live
```

---

## 📄 License & Attribution

Privately created for real-time collaborative digital art. Built with Next.js, Convex, and HTML5 Canvas.
