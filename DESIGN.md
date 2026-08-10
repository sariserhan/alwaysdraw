---
name: AlwaysDraw
description: One world. One canvas. Always drawing.
colors:
  # Dark values (the default theme). See Colors > Theming below for the
  # light-theme override values — this frontmatter carries one canonical
  # set per the DESIGN.md spec, so light values live in prose, not here.
  chrome-bg: "#17181a"
  chrome-bg-raised: "#202224"
  chrome-bg-recessed: "#101112"
  chrome-border: "#3a3530"
  rust: "#b5502c"
  concrete: "#f0ebd9"
  ink: "#f5f1e6"
  ink-dim: "#cdc7b8"
  accent-crimson: "#e0432b"
  accent-crimson-deep: "#b8371f"
  accent-green: "#39c07a"
  accent-blue: "#2f9fe0"
  accent-yellow: "#e0b13a"
  on-accent: "#f5f1e6"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.22em"
  label:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
  mono:
    fontFamily: "Space Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "2px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  toolbar-panel:
    backgroundColor: "{colors.chrome-bg-raised}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  status-pill:
    backgroundColor: "{colors.chrome-bg-raised}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  button-active:
    backgroundColor: "{colors.accent-crimson-deep}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  button-inactive:
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
---

# Design System: AlwaysDraw

## Overview

**Creative North Star: "The Bolted Rack"**

AlwaysDraw is a rusted train-yard wall that the whole internet keeps tagging — not a whiteboard app with a toolbar politely floating over a blank page. The interface reads as mounted hardware: a riveted steel strip and a bolted spray-can rack, both bolted directly to the edges of the screen, framing a full-bleed sheet of warm paper anyone can mark. Chrome is near-black weathered steel; the canvas itself is a plain, warm parchment tone (not stark white — closer to aged paper) so any color painted onto it reads clearly — the ground carries no texture of its own, deliberately, so it never competes with what people actually draw on it. Nothing about the chrome is soft, rounded, or ambient — depth comes from hard borders, mounting hardware, and directional shadows, the way real equipment sits on a wall, not from floating cards or glassy panels.

This world was chosen explicitly against the category default for collaborative drawing tools (Miro/FigJam/Excalidraw-style soft pastel whiteboards) — that direction is the confirmed anti-reference. It was also chosen against a neon-cyberpunk night-district direction that scored well on recognition but ran into the same AI-generated-interface cliché (near-black + one neon accent) the brief asked to avoid.

**Key Characteristics:**
- Near-black steel chrome bolted to the viewport edges; a warm paper-toned canvas in between
- A curated four-color spray-paint accent set (crimson, acid green, electric blue, warning yellow), each with one fixed system role — never decorative
- Real stencil-plate construction (masked bridge-gaps) on the wordmark and on every measurement/count numeral
- Fully circular shapes reserved for literal hardware and indicator lights (rivets, swatches, cursors, status dots) — every panel and control otherwise stays rectilinear
- No soft ambient shadows; depth reads as mounted hardware (rivets, brackets, hard borders) and directional drop shadows only

## Colors

A near-black steel-and-rust neutral system carries the interface; a four-color spray-paint accent set is reserved for status, action, and per-user identity — never used decoratively.

### Primary
- **Rust** (`#b5502c`): the system's signature accent. Marks anything tied to *shared/live state at the wall level* — the online-count plate's wash and border, canvas rust-bleed streaks, the top bar and toolbar's structural borders. Never used for interactive controls.
- **Deep Crimson** (`#b8371f`): the accent-bearing-text variant of Crimson (below), used only where a solid fill sits directly under white text (the active Brush/Erase button) — picked specifically to clear 4.5:1 contrast at small bold sizes, where the brighter Crimson falls short.

### Secondary
- **Crimson** (`#e0432b`): the primary spray-can color — default brush-size slider accent, first color-swatch highlight ring is yellow but crimson anchors the swatch set's warm end.
- **Acid Green** (`#39c07a`): "alive" — the online-presence dot and the "Live" connection state. Reserved for genuine live/connected signals only.
- **Electric Blue** (`#2f9fe0`): one of the rotating per-user remote-cursor colors; otherwise a swatch option.
- **Warning Yellow** (`#e0b13a`): "attention" — the "Reconnecting" connection state, the focus-visible ring color, and the selected-swatch ring. Reserved for states that need a second look.

### Neutral
- **Chrome Black** (`#17181a`): the base chrome surface — page background, top bar, inset control wells.
- **Chrome Raised** (`#202224`): one step up from Chrome Black — toolbar body, status pills, the color-swatch tray. Never used for full-bleed backgrounds.
- **Chrome Recessed** (`#101112`): one step down from Chrome Black — the toolbar's own internal gradient floor, implying the panel is lit from above.
- **Steel Border** (`#3a3530`): all structural hairline borders on chrome surfaces.
- **Concrete** (`#f0ebd9`): the canvas ground — a plain flat warm-paper fill (not stark white), deliberately light so any spray color painted on it stays legible, and deliberately textureless so it never competes with what's drawn on it. Kept the token name from the original material study; the tone itself reads as paper, not poured concrete.
- **Stencil Ink** (`#f5f1e6`): primary text on chrome.
- **Ink Dim** (`#b8b3a6`): secondary/label text on chrome (tool labels, "online"/"live" captions, size labels).
- **On-Accent** (`#f5f1e6`): text sitting directly on a saturated accent fill (the active Brush/Erase button, `::selection`). Fixed — does not swap with theme, since the accent fill beneath it doesn't either.

### Theming
Dark is the committed default — a deliberate scene (an underpass at night), not a system-preference default — but a light variant exists as a manual, persisted override (the sun/moon toggle in the top bar). Only the five chrome/text tokens above swap; Rust, Concrete, and the four accent colors are identical in both themes, since they're the wall's own material, not UI chrome.

| Token | Dark (default) | Light |
|---|---|---|
| Chrome Black | `#17181a` | `#e7e3d9` |
| Chrome Raised | `#202224` | `#f4f1e8` |
| Chrome Recessed | `#101112` | `#d8d3c4` |
| Steel Border | `#3a3530` | `#a89f8c` |
| Stencil Ink | `#f5f1e6` | `#201d18` |
| Ink Dim | `#cdc7b8` | `#4d4536` |

**The Wall Doesn't Change Rule.** Theme only ever swaps chrome (steel/text). The Concrete canvas, Rust, and the four spray-paint accents are the same in both themes — the shared wall is one object regardless of what time of day you're looking at your own screen in.

### Named Rules
**The One Surface, One Voice Rule.** Chrome (steel, near-black, rust) and canvas (concrete, warm gray) never swap roles. If it's a control or status element, it lives on chrome. If it's paintable world, it's concrete.

**The Reserved Accent Rule.** Each accent color has exactly one system meaning — green means live, yellow means attention, rust means "this plate is a live-count instrument," crimson-deep means "this control is active." None of the four are ever used interchangeably as generic decoration.

## Typography

**Display/UI Font:** Space Grotesk (with system-ui, sans-serif fallback)
**Measurement Font:** Space Mono (with ui-monospace, monospace fallback)

**Character:** A technical, slightly industrial grotesk paired with a mechanical mono — the same pairing an equipment placard or shipping-crate stencil would use. Space Grotesk carries every word; Space Mono is reserved strictly for things that count or measure.

### Hierarchy
- **Wordmark** (700, 0.875rem / 14px, tracked 0.22em, uppercase, stencil-cut): the "AlwaysDraw" mark in the top bar — the only place the stencil-bridge mask is used, anywhere, at any size.
- **Label** (600 / 700, 0.6875–0.75rem / 11–12px, uppercase, tracked wide, plain — no mask): tool button labels (Brush/Erase/Pan/Zoom), the "Size"/"Opacity" captions, brush-picker category headers, status pill captions ("live"/"online").
- **Measurement** (400, 0.75rem / 12px, Space Mono, tabular-nums, plain — no mask): every live number — online count, zoom percentage, brush-size value.

### Named Rules
**The Numerals-Are-Instruments Rule.** Any number that changes at runtime (online count, zoom %, brush size) renders in Space Mono, always plain. Static UI words never use Space Mono.
**The Wordmark-Only Mask Rule.** The stencil-cut bridge mask is applied to exactly one element: the top-bar wordmark. It was tried on toolbar labels at a smaller scale twice — once on live numerals, once on the Brush/Erase tool labels — and broke legibility both times; real users could not read it. A mask that fails at every size except one isn't a scalable device, it's a single decoration, and this file now treats it as such.
**The Legible-Secondary-Text Rule.** Secondary/inactive text (`--ink-dim`) must hold real contrast, not just pass a ratio check — the token was pushed further from its background in both themes (dark: lighter, `#b8b3a6`→`#cdc7b8`; light: darker, `#62594a`→`#4d4536`) after users reported toolbar captions unreadable even though the prior values cleared 4.5:1. Small, thin, wide-tracked mono/grotesk text needs contrast headroom beyond the legal minimum.

## Layout

A single full-bleed canvas fills the viewport; all UI is two bolted fixtures at the screen's edges, never a floating card layout. The top bar is a full-width strip flush to the top edge (padding: 10px 16px). The toolbar is a compact rack centered at the bottom edge, flush enough to read as mounted rather than floating (bottom padding reduced to 8px, not the ~16px a typical floating-FAB toolbar would use). Control groups inside the toolbar are separated by hairline dividers and 12px gaps; individual controls sit on 4-8px internal padding. The toolbar wraps onto a second row on narrow viewports rather than truncating or scrolling.

## Elevation & Depth

No soft ambient shadows or glassy panels. Depth comes from three devices instead: (1) hard 1-2px borders on every chrome surface, (2) directional drop shadows that ground a fixture against the canvas behind it, and (3) physical mounting hardware — rivets and bracket tabs — that implies the fixture is bolted on, not floating. The one deliberate exception is small point-glows on live-status indicator dots (green/yellow), styled like an LED rather than a decorative effect.

### Shadow Vocabulary
- **Rack drop** (`box-shadow: 0 10px 28px rgba(0,0,0,0.5)`): the toolbar's grounding shadow — heavy, directional, implies real weight hanging off the bottom edge.
- **Strip drop** (`box-shadow: 0 2px 10px rgba(0,0,0,0.5)`): the top bar's shadow — shallow since it's flush to the edge, not hanging.
- **Indicator glow** (`box-shadow: 0 0 6px var(--accent-green)` or `var(--accent-yellow)`): status-dot point light. Reserved for the two live-status dots only.
- **Bolt-head relief** (`box-shadow: inset 0 1px 1.5px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.1)` over a radial-gradient fill): every rivet. This is hardware relief, not a card shadow — never apply it to a rectangular surface.

### Named Rules
**The No Floating Card Rule.** Nothing in this system is a rounded, softly-shadowed card hovering over the canvas. Every fixture is bolted (rivets/brackets), bordered, and grounded with a hard directional shadow.

## Shapes

**The Round-Is-Hardware Rule.** Fully circular geometry (`rounded-full`) is reserved for literal fasteners, caps, and indicators: rivets, color swatches (styled as spray-can caps), the custom-color picker, remote-cursor paint-drips, and status dots. Every panel, button, and input well stays rectilinear at a small `2px` radius (`rounded-sm`) or square (`rounded-none`) — never the `8-16px` soft-card radius common to whiteboard apps. Mounting brackets are small square-cornered tabs, not pills.

Additional signature geometry: small teardrop drip shapes hanging from the toolbar's bottom edge. The canvas ground itself is deliberately bare geometry (a fill and a border, nothing more) — see Canvas Ground below.

## Components

### Buttons (tool toggle, zoom controls)
- **Shape:** rectilinear, `rounded-sm` (2px), never pill-shaped.
- **Active state:** solid Deep Crimson fill (`#b8371f`) with On-Accent text — the AA-safe crimson, not the brighter Crimson used for swatches/sliders, and a theme-fixed text color since the fill beneath it doesn't change with theme.
- **Inactive state:** Ink Dim text, no fill, hover raises to Chrome Raised background + Stencil Ink text.
- **Icons:** authored inline SVG, one consistent 1.75-2px stroke weight — never a Unicode glyph or emoji standing in for an icon.

### Status Pills (ConnectionStatus, OnlineCount)
- **Style:** `rounded-sm`, Chrome Raised background, 1px border.
- **Live/attention differentiation:** ConnectionStatus uses a plain Steel Border; OnlineCount uses a Rust border plus a subtle rust-tinted gradient wash — the two pills are deliberately NOT twins, since one is a live-count instrument and the other is a binary connection flag.
- **Indicator:** a 6px dot with a matching `0 0 6px` color glow — green for live/online, yellow (pulsing) for reconnecting.

### The Header
Left to right: wordmark, live tile-visibility badge, online count — then, on wide viewports, the header's own controls grouped into clusters (Preferences: Theme/Sound/Grid; Discover: Compass/Explore/Highlights/Bookmarks; History & Export: Time Travel/Export; Reference: Hotkeys/Help) separated by a thin **Header Seam** — a 1px Steel Border rule, not a bordered box. Each control is already its own self-bordered chip (border + Chrome Raised background), so clusters are separated by spacing + a seam rather than nesting them in a second border, which read as a box-in-a-box. Below `lg`, all of it collapses into a single MENU button opening a drawer; the drawer repeats the same four cluster labels as small uppercase section headers above their own mini-grids, so the grouping logic is identical on mobile, just laid out vertically instead of horizontally. Connection Status stays outside every cluster, always visible, since it's a status flag worth seeing regardless of what else is going on.
- **Rule:** a header control is a self-bordered chip on its own (border + Chrome Raised background, per Status Pills/Buttons above) — never wrap a cluster of chips in a second bordering box. Separate clusters with a Header Seam or spacing only.

### The Toolbar (signature component)
The system's one distinctive custom component. A rectilinear rack (`rounded-sm`, 2px border, `ring-1 ring-rust/25` inset accent) mounted to the bottom edge via two small square bracket tabs at its top-left/top-right corners, each carrying a rivet, plus a third top-center chevron tab. Internally, left to right: a bordered four-tool group (Brush/Erase/Pan/Zoom), seven fixed spray-cap color swatches plus a rainbow-conic custom-color picker, a ruler-icon Size control, a droplet-icon Opacity control, and a zoom%/reset cluster — all Space Mono for the live numbers, Space Grotesk labels for everything else.
- **Two independent levels of "less rack":** the two rivet-bearing brackets are themselves the collapse toggle (the hardware you'd actually unbolt to fold the rack down) and shrink it to just the four-tool group. The top-center chevron is a separate, more drastic control — hides the entire rack, leaving only a small pull-tab docked at the bottom edge to bring it back. The two states are independent and both persist across each other (hiding a collapsed rack shows it collapsed again).
- A row of teardrop drip shapes hangs from the bottom edge only while fully expanded.
- **Selected-state rule:** the active color swatch and active custom-color ring grow from 24px to 32px (not just a ring change) — a same-size selection ring alone tested as too subtle to notice at a glance; size change is the primary signal, the yellow ring is secondary confirmation.

### Brush Picker (signature component)
Tapping the active Brush tool (when it's already selected) opens a popover above the rack — same rectilinear-rack language (`rounded-sm`, 2px border, Chrome Raised) as the toolbar itself, not a separate floating card. Twelve brushes grouped under three plain category captions (Basic, Artistic, Effects) matching the product's own catalog, each a two-column grid of text buttons using the same active/inactive treatment as every other button (Deep Crimson fill + On-Accent text when selected). Selecting a brush also switches the active tool to Brush, so picking a texture and drawing with it is one motion, not two.

### Pan, Magnifier, Shapes & Ruler Tools
Four explicit modes alongside Brush/Erase, each suppressing drawing entirely while active — they are inspection/utility tools, not brush variants:
- **Pan:** turns any single-pointer drag into a camera pan — for touch users and anyone who'd rather not learn space-drag/pinch.
- **Magnifier:** a hover-only loupe (see below) — inspects the wall at a higher effective zoom without moving the actual camera.
- **Shapes:** opens an icon-only popover (Line, Square, Circle, Triangle — no text labels, unlike the Brush picker) above the rack; drag a bounding box on the canvas and release to commit a clean outline stroke in the current color/size/opacity, rendered with the plain Brush texture regardless of whatever artistic brush is otherwise selected.
- **Ruler:** drag between two points to read the distance (world px) as a dashed line + label; purely an inspection overlay, never added to the shared wall.

The canvas cursor reflects the active tool: grab/grabbing for Pan, the browser's default arrow for Magnifier, a crosshair for Shapes/Ruler, and the custom Brush Cursor (below) for Brush/Erase.

### Brush Cursor (signature component)
The OS cursor is hidden over the canvas whenever Brush or Erase is active; a custom overlay takes its place, rendered at the brush's real on-screen diameter (`brushWidth × zoom`, in screen pixels — not a fixed icon size), so a visitor always sees exactly how much of the shared wall their next stroke or erase will affect before they commit to it. A translucent color-tinted ring plus a small solid center dot for most brushes; per-brush variants read the same identity the brush renders with — square for Pixel, a rotated ellipse for Calligraphy, a dashed ring for the grainy brushes (Chalk/Charcoal), a soft blurred ring for Watercolor/Highlighter, a glow (`box-shadow`) for Neon Glow, a small authored sparkle mark for Glitter, and a neutral ring with an authored × mark (not the color) for Erase, since erasing has no "color" of its own. Position/size update via direct DOM style writes on every pointer move and on every camera-zoom frame — too high-frequency for React state — while shape/color are ordinary props that only change when the toolbar selection changes.

### Remote Cursors
- **Style:** a small SVG paint-drip (teardrop) shape, not a plain circle or arrow — each remote visitor's cursor is colored by hashing their anonymous client ID against the four-color accent set, so different visitors read as visibly different "spray cans" on the wall. (Distinct from the Brush Cursor above, which represents your own tool, not another visitor.)

### Canvas Ground
- **Style:** a flat warm-paper Concrete fill with a 1px Rust-colored border along the world edge. Deliberately plain — no grid, crack, seam, or grain texture. This was tried (a poured-slab expansion-joint grid plus hairline cracks) and pulled after real use: the texture visually competed with the strokes people actually draw, which defeats the point of a drawing surface. The strokes are the only visual complexity the ground carries.
- **Architecture:** rendered on its own canvas layer, stacked beneath a separate transparent strokes layer. This is load-bearing, not incidental — erasing (`destination-out`) clears pixels on the strokes layer only, revealing the Concrete ground underneath rather than punching a transparent hole to whatever sits behind the page.
- **Rule:** if ground texture is ever reconsidered, it must be explicit, specifiable geometry (lines, polylines, filled shapes) — never a repeating-noise/`feTurbulence` grain effect.

## Do's and Don'ts

### Do:
- **Do** keep chrome near-black/steel and canvas warm-paper-light — the contrast between the two is what makes painted strokes legible and is a load-bearing part of the identity.
- **Do** keep the stencil-cut mask confined to the wordmark alone — it was tried at smaller scale twice and hurt legibility both times; treat it as a one-off identity mark, not a reusable texture.
- **Do** give every new fixed UI panel a hard border + directional drop shadow + at least implied mounting hardware before shipping it; a panel with none of the three will read as a floating card.
- **Do** reserve fully circular shapes for hardware/indicators (rivets, caps, dots, cursors); keep panels and buttons rectilinear at the `2px` radius.
- **Do** author any new texture (grain, wear, damage) as explicit, deterministic vector geometry — polylines, filled shapes, gradients along a path — never a repeating/random noise pattern.
- **Do** give any "pick anything" control (the custom color picker) a persistent, color-independent affordance — the rainbow conic-gradient — so it never gets mistaken for just another preset swatch showing the current selection.
- **Do** let the camera go wherever the user pans/zooms it, at any zoom level. A prior "snap back to center when zoomed out" behavior was removed once the Pan tool shipped — forcing position fights a tool whose entire job is letting the user choose position.

### Don't:
- **Don't** introduce rounded-lg/rounded-xl soft cards, pill-shaped panels, or ambient glassy blur — that's the whiteboard-SaaS world this system was explicitly built against.
- **Don't** use a Unicode glyph or emoji as a functional icon; author real SVG at a consistent stroke weight.
- **Don't** use the brighter Crimson (`#e0432b`) as a solid fill under white text — it fails the 4.5:1 contrast floor at small bold sizes; use Deep Crimson (`#b8371f`) for any text-bearing crimson fill.
- **Don't** add a neon-on-black treatment anywhere in this system — it was a dealt, competitive alternative direction (Neon District) explicitly not chosen, in part because it reads as the generic AI-generated-interface cliché.
- **Don't** let a new accent color creep in beyond the four reserved spray-paint colors (Crimson, Acid Green, Electric Blue, Warning Yellow) without updating this file — the palette's restraint is a named rule, not an accident.
