# AlwaysDraw — Features & Capabilities Guide

> **One world. One canvas. Always drawing.**  
> A real-time, infinite 20,000×20,000 collaborative drawing wall powered by Next.js, HTML5 Canvas, and Convex.

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
- **Symmetry & Mandala Kaleidoscope Engine (`🔮`):**
  - **2-Way Horizontal Mirror:** Axis reflection across canvas center.
  - **4-Way Quadrant Symmetry:** Quadrant reflection.
  - **8-Way Mandala Radial Symmetry:** 8-fold rotational kaleidoscope symmetry for mandalas and logos.
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
- **Activity Density Heatmap (`G`):** Toggleable spatial heatmap overlay visualizing high-activity drawing hotspots across the 20,000x20,000 wall.
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
