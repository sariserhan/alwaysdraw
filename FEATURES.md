# AlwaysDraw — Features & Capabilities Guide

> **One world. One canvas. Always drawing.**  
> A real-time collaborative drawing wall powered by Next.js, HTML5 Canvas, and Convex.

---

## 🎨 1. Core Drawing & Brush Engine

- **12 Distinct Brush Textures:**
  - **Basic:** Standard Brush, Pencil, Marker, Highlighter, Calligraphy Chisel, Retro Pixel.
  - **Artistic:** Soft Watercolor, Heavy Oil Paint, Chalk Grain, Charcoal Spray.
  - **Effects:** Sparkle Glitter, Glowing Neon.
- **Eyedropper Color Picker (`I`):** Sample color from any stroke or artwork mark on the wall with native browser fallback.
- **Controlled Hex & Color Palette System:** 6-digit hex validator with curated color palette presets (Cyberpunk, Retro Arcade, Pastel, Industrial, etc.).
- **Dynamic Brush Controls:** Adjustable stroke width (1px – 100px) and opacity (5% – 100%).
- **Dual-Canvas Rendering Engine:** Stacked background layer (concrete wall texture) beneath a transparent stroke layer. Erasing (`mode: "erase"`) uses `destination-out` to reveal the wall texture rather than punching a hole through the page.

---

## ✍️ 2. Vector Text & Shapes

- **Vector Text Tool (`X`):** Type custom text anywhere on the canvas.
  - **Typography Styles:** Sans (Space Grotesk), Mono (Space Mono), Retro Pixel (`Press Start 2P`), Serif (Georgia), and Script (Cursive).
  - **Clean Vector Output:** Text is converted into clean vector stroke paths (`Point[][]`) that sync in real-time across all clients.
- **Expanded Vector Shapes (`S`):** Drag-and-drop precise geometric primitives:
  - **Lines & Directional Arrows:** Straight lines and arrowhead vectors.
  - **Squares & Circles:** Rectangles and smooth circular arcs.
  - **Triangles & Polygons:** Triangles, 5-point Stars, and 6-side Hexagons.
  - **Hearts:** Parametric cardioid heart curves.

---

## 🪄 3. Special Creative Tools

- **Flood Fill Bucket (`F`):** Tap any area to generate dense spiral fill strokes in your active color.
- **Sticker & Emoji Stamp Library:** Stamp retro sprites, badges, emojis, skulls, fire, rockets, and stars directly onto the canvas wall.
- **Architectural Ruler (`R`):** Measure distance (in canvas world units) between any two points with dynamic screen-space guides.
- **Industrial Stencil Sprayer (`T`):** Spray industrial stencil art (Biohazard, Crown, Skull) onto the canvas.
- **Laser Pointer (`L`):** Temporary glowing laser trail that fades away after 2 seconds.

---

## 👥 4. Real-Time Collaboration & Community

- **Multiplayer Stroke Sync:** Instant reactive synchronization across concurrent browser sessions via Convex.
- **Live Remote Cursors & Online Counter:** View active collaborators' cursor positions, display names, and flag indicators on the canvas.
- **Sticky Note Comments Overlay (`C`):** Post floating, interactive sticky notes and feedback comments at specific canvas coordinates.
- **Viewport Bookmarks & Deep-Linking:** Save favorite canvas locations, share direct URLs with camera position (`?x=...&y=...&z=...`), and teleport back in 1-click.
- **Multi-Language Support (i18n):** Full internationalization support for English, Turkish, Spanish, German, French, and more.

---

## 🗺️ 5. Navigation & Exploration

- **Smooth Pan & Focal-Point Zooming:** Pan (`H` or Space+Drag) and focal-point zoom (`+`/`-`/Wheel/Pinch) keeping the point under the cursor stationary.
- **MiniMap Navigation:** Fixed mini-map widget showing viewport bounding box, active stroke density, and click-to-teleport navigation.
- **Activity Density Heatmap (`G`):** Toggleable spatial heatmap overlay visualizing high-activity drawing hotspots across the wall.
- **Spatial Compass & Coordinates:** Real-time HUD displaying camera coordinates, zoom level, and origin teleport button.

---

## ⏳ 6. Time Travel & History Replay

- **Interactive Replay Bar:** Replay the historical creation of the wall stroke-by-stroke starting from any global sequence index.
- **Playback Controls:** Pause, play, step forward/backward, and adjust speed (1x, 2x, 5x, 10x).

---

## 🛡️ 7. Admin Moderation & Mural Shield

- **Admin Operations Control Center (`Shift+A`):** Authenticated modal panel for canvas maintenance.
- **Protected Canvas Zones (Mural Shield):** Lock designated canvas rectangular regions to prevent community artwork from being edited or overwritten by regular users.
- **Admin Image Stamping:** Upload images, scale aspect ratios, preview placement on canvas, and rasterize them into world strokes with rate-limit error toasts.
- **Area Wipe & Client Rollback:** Bounding-box stroke purge (`wipeArea`) and target client stroke rollback (`rollbackClient`).
- **Global Broadcast Banner:** Publish live announcement banners to all online visitors.
- **System Telemetry:** Real-time telemetry monitoring stroke counts, active presence, snapshots, and sequence counters.

---

## ⚡ 8. Technical Architecture & Quality

- **Spatial Tiling System:** 500×500 px spatial cell index for fast tile-based rendering and viewport culling.
- **Canvas Snapshots & Fast Catch-up:** Periodic snapshot generation and sequence-based delta catch-up for fast initial page load times.
- **Offline & Local-First Buffering (`StrokeBuffer`):** Pointer input renders instantly to canvas and buffers into ~40-point chunks flushed every ~40ms to prevent network latency.
- **Comprehensive Test Coverage:**
  - **100/100 Unit Tests (`vitest`):** Pure camera math, coordinate conversions, stroke validation, tiling, admin endpoints, and text vectorization.
  - **Playwright E2E Suite (`playwright test`):** Automated smoke tests and live two-browser multiplayer synchronization tests.

---

## 🔬 9. How It Works — Technical Implementation Deep Dive

### 9.1 Local-First Instant Drawing & `StrokeBuffer` (`lib/strokeBuffer.ts`)
- **0ms Input Latency:** Pointer events map directly to 2D canvas drawing calls (`ctx.lineTo`) on the active screen canvas frame, rendering instantly without waiting for a server round-trip.
- **Batching & Chunking:** Pointer points are collected into `StrokeBuffer`. Every ~40ms or 40 points, `StrokeBuffer.flush()` creates a discrete `LocalStroke` chunk payload assigned a unique UUID.
- **Boundary Continuity:** Consecutive chunks copy the last point of the preceding chunk as their starting point, ensuring zero visual gap between batch flushes.

### 9.2 Reactive Backend & Sequence Ordering (`convex/strokes.ts`)
- **Authoritative Sequencing:** When `strokes.submit` executes on Convex, it runs inside an atomic transaction that increments `canvasMetadata.currentSequence` and assigns this sequence ID to the inserted stroke.
- **Idempotent Retry Safety:** Each stroke carries a client-generated `clientStrokeId`. Retrying a dropped network request will hit the unique index on `clientStrokeId` and return the existing sequence number without duplicate insertions.
- **Live Tail Syncing:** Clients subscribe to `strokes.listRecent` or `strokes.listSince(afterSequence)`. When new sequence IDs are committed by any online player, all connected browsers apply the new strokes to their local canvas in sequence order.

### 9.3 Vector Text Font Engine (`lib/textToPoints.ts`)
- **Normalized Glyph Maps:** Contains normalized stroke polyline paths ($[0..1] \times [0..1]$) for every letter in the alphabet, numbers, and symbols (`GLYPHS`).
- **Path Generation (`convertTextToStrokePaths`):** Translates input text string into world-coordinate vector paths (`Point[][]`), scaling by selected font size (`textSize`) and adding letter/line spacing.
- **Zero Zig-Zag Webbing:** Each letter path is flushed as separate continuous stroke lines via `StrokeBuffer`, preventing cross-line artifacts and producing sharp, crisp vector text across all clients.

### 9.5 Flood Fill Engine (`lib/floodFill.ts`)
- **Spiral Fill Generator:** `generateFloodFillPoints` calculates an expanding spiral path originating from target click coordinates $(X_0, Y_0)$ with radial step spacing.
- **Server Persistence:** The generated spiral points are submitted as standard stroke mutations, allowing filled areas to be stored, tile-indexed, snapshot-cached, and synced across players.

### 9.6 Deterministic Brush Texture Rendering (`lib/brushes.ts`)
- **Flicker-Free Textures:** Texture grain and scatter (for Chalk, Charcoal, Oil Paint, Glitter, and Neon Glow) are generated using a deterministic integer hash function (`hash(seed)` and `pointSeed(point, salt)`) seeded by world coordinates.
- **Zero Redraw Flicker:** Because `hash(point)` returns the exact same pseudo-random value for any point coordinate, re-rendering visible strokes when panning or zooming never causes texture flicker or grain jittering.

### 9.7 Spatial Tiling & Viewport Culling (`lib/tiling.ts`)
- **500×500 Spatial Cell Grid:** The canvas is indexed into 500×500 px spatial tile cells (`tile_X_Y`).
- **Bounding Box Calculation:** When a stroke is submitted, `getTileKeysForStroke` computes all tile keys spanned by the stroke's bounding box.
- **Viewport Culling:** During redraws, `getVisibleTileKeys(camera, viewportWidth, viewportHeight)` determines which 500x500 cell tiles intersect the screen camera view frustum, filtering out off-screen strokes before invoking 2D canvas draw operations.

### 9.8 Protected Canvas Zones / Mural Shield (`convex/admin.ts` & `ProtectedZonesOverlay.tsx`)
- **Server-Enforced Bounding Box Shield:** Active protected zone rectangles are stored in `protectedZones`. During `strokes.submit`, server loops through protected zones and rejects any stroke whose points intersect a zone unless `clientId` starts with `"ADMIN_"`.
- **Dynamic Overlay & Edge Safety:** `ProtectedZonesOverlay` projects yellow dashed bounding boxes onto the screen overlay using `worldToScreen`. Badge labels dynamically adjust vertical offsets (`topLeft.y < 24 ? "top-1" : "-top-4"`) to prevent clipping at the top edge of the browser viewport.

### 9.9 Focal-Point Camera Math (`lib/camera.ts` & `lib/coordinates.ts`)
- **Focal-Point Zooming:** `zoomAt(camera, mouseScreenPt, zoomFactor)` computes new camera pan offsets such that the world coordinate directly under the mouse cursor remains in the exact same screen location after zooming.
- **Reversible Coordinate Transforms:** `screenToWorld` and `worldToScreen` perform exact inverse matrix transforms:
  $$X_{screen} = (X_{world} - X_{cam}) \cdot \text{zoom} + \frac{W_{vw}}{2}$$
  $$X_{world} = \frac{X_{screen} - \frac{W_{vw}}{2}}{\text{zoom}} + X_{cam}$$
