import type { Camera } from "./camera";
import { worldToScreen } from "./coordinates";
import type { BrushType, Point } from "./types";
import { configureContext } from "./drawing";

/** Deterministic pseudo-random in [0,1) — same input always renders the same
 * texture, so grain/scatter brushes don't flicker between redraws. */
function hash(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

function pointSeed(p: Point, salt: number): number {
  return hash(Math.floor(p.x * 37) + Math.floor(p.y * 101) * 7919 + salt * 104729);
}

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(color: string): RGBA {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m) {
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] !== undefined ? Number(m[4]) : 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function shade(color: string, amount: number, alpha = 1): string {
  const { r, g, b } = parseColor(color);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgba(${clamp(r + amount)}, ${clamp(g + amount)}, ${clamp(b + amount)}, ${alpha})`;
}

function toScreen(points: Point[], camera: Camera, vw: number, vh: number): Point[] {
  return points.map((p) => worldToScreen(p.x, p.y, camera, vw, vh));
}

function strokePath(ctx: CanvasRenderingContext2D, pts: Point[]) {
  if (pts.length === 1) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: Point, r: number) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(0.4, r), 0, Math.PI * 2);
  ctx.fill();
}

/** Walk a polyline in fixed-length screen-space steps, calling `fn` at each sample. */
function walk(pts: Point[], stepPx: number, fn: (p: Point, t: number, segIndex: number) => void) {
  if (pts.length === 0) return;
  fn(pts[0], 0, 0);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.floor(len / stepPx));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      fn({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, t, i);
    }
  }
}

export type BrushRenderArgs = {
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  points: Point[];
  color: string;
  width: number;
  /** User-controlled opacity, 0..1, multiplied into every alpha this brush draws with. */
  opacity: number;
};

type BrushRenderer = (args: BrushRenderArgs) => void;

/** ctx.globalAlpha = a * opacity — every renderer routes through this so opacity is honored uniformly. */
function setAlpha(ctx: CanvasRenderingContext2D, a: number, opacity: number) {
  ctx.globalAlpha = Math.max(0, Math.min(1, a * opacity));
}

function basicStroke(screenWidth: number, alpha = 1, composite: GlobalCompositeOperation = "source-over") {
  return ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }: BrushRenderArgs) => {
    const pts = toScreen(points, camera, viewportWidth, viewportHeight);
    configureContext(ctx);
    ctx.globalCompositeOperation = composite;
    setAlpha(ctx, alpha, opacity);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, width * camera.zoom * screenWidth);
    if (pts.length === 1) dot(ctx, pts[0], ctx.lineWidth / 2);
    else strokePath(ctx, pts);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };
}

const brush: BrushRenderer = basicStroke(1);

const pencil: BrushRenderer = (args) => {
  const { ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity } = args;
  const pts = toScreen(points, camera, viewportWidth, viewportHeight);
  configureContext(ctx);
  const lw = Math.max(0.75, width * camera.zoom * 0.45);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  // Two faint offset passes fake a graphite grain without per-pixel noise.
  for (let pass = 0; pass < 2; pass++) {
    setAlpha(ctx, pass === 0 ? 0.75 : 0.35, opacity);
    const jitter = pts.map((p, i) => {
      const s = pointSeed(p, pass * 11 + i);
      return { x: p.x + (s - 0.5) * lw * 0.6, y: p.y + (hash(s * 999 + pass) - 0.5) * lw * 0.6 };
    });
    if (jitter.length === 1) dot(ctx, jitter[0], lw / 2);
    else strokePath(ctx, jitter);
  }
  ctx.globalAlpha = 1;
};

const marker: BrushRenderer = basicStroke(1.3, 0.6);
const highlighter: BrushRenderer = basicStroke(2.0, 0.45, "multiply");

const PEN_ANGLE = Math.PI / 4;
const calligraphy: BrushRenderer = ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
  const pts = toScreen(points, camera, viewportWidth, viewportHeight);
  configureContext(ctx);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  setAlpha(ctx, 1, opacity);
  const baseWidth = width * camera.zoom;
  if (pts.length === 1) {
    dot(ctx, pts[0], baseWidth * 0.5);
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const factor = 0.3 + 0.7 * Math.abs(Math.cos(angle - PEN_ANGLE));
    ctx.lineWidth = Math.max(1, baseWidth * factor);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
};

const pixel: BrushRenderer = ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
  const cell = Math.max(2, width * camera.zoom);
  setAlpha(ctx, 1, opacity);
  ctx.fillStyle = color;
  const stamped = new Set<string>();
  const stampWorld = (p: Point) => {
    const gx = Math.round(p.x / width) * width;
    const gy = Math.round(p.y / width) * width;
    const key = `${gx},${gy}`;
    if (stamped.has(key)) return;
    stamped.add(key);
    const s = worldToScreen(gx, gy, camera, viewportWidth, viewportHeight);
    ctx.fillRect(s.x - cell / 2, s.y - cell / 2, cell, cell);
  };
  if (points.length === 1) {
    stampWorld(points[0]);
    return;
  }
  // Consecutive points are normally adjacent pointer samples from a real
  // drag, so connecting them with interpolated stamps is what makes a fast
  // stroke look continuous instead of dotted. Flood fill reuses this same
  // brush type but submits scattered fill points in traversal order, not
  // drag order — two consecutive points there can be on opposite sides of
  // the filled region. Interpolating across a gap that large draws a
  // spurious line, so treat any jump wider than a real drag frame ever
  // produces as a break: stamp the far point on its own instead.
  const MAX_JUMP_SCREEN_PX = 64;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const sa = worldToScreen(a.x, a.y, camera, viewportWidth, viewportHeight);
    const sb = worldToScreen(b.x, b.y, camera, viewportWidth, viewportHeight);
    if (Math.hypot(sb.x - sa.x, sb.y - sa.y) > MAX_JUMP_SCREEN_PX) {
      stampWorld(b);
      continue;
    }
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len / Math.max(1, width)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stampWorld({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
};

const watercolor: BrushRenderer = ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
  const pts = toScreen(points, camera, viewportWidth, viewportHeight);
  const baseR = Math.max(1.5, (width * camera.zoom) / 2);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const stampAt = (p: Point, seed: number) => {
    const rJitter = 0.75 + hash(seed) * 0.6;
    const r = baseR * (1.3 + rJitter * 0.6);
    const dx = (hash(seed * 3 + 1) - 0.5) * baseR * 0.5;
    const dy = (hash(seed * 5 + 2) - 0.5) * baseR * 0.5;
    const grad = ctx.createRadialGradient(p.x + dx, p.y + dy, 0, p.x + dx, p.y + dy, r);
    grad.addColorStop(0, shade(color, 0, 0.22 * opacity));
    grad.addColorStop(0.7, shade(color, 0, 0.12 * opacity));
    grad.addColorStop(1, shade(color, 0, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x + dx, p.y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  let i = 0;
  walk(pts, Math.max(3, baseR * 0.6), (p) => {
    stampAt(p, pointSeed(p, i));
    i++;
  });
  ctx.globalAlpha = 1;
};

const oilPaint: BrushRenderer = ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
  const pts = toScreen(points, camera, viewportWidth, viewportHeight);
  configureContext(ctx);
  const lw = Math.max(1.5, width * camera.zoom);
  // Base opaque body.
  setAlpha(ctx, 1, opacity);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  if (pts.length === 1) dot(ctx, pts[0], lw / 2);
  else strokePath(ctx, pts);
  // Ridge passes: thinner, shade-shifted, perpendicular-offset for impasto texture.
  for (let pass = 0; pass < 3; pass++) {
    const amount = pass % 2 === 0 ? 38 : -32;
    ctx.strokeStyle = shade(color, amount, 1);
    setAlpha(ctx, 0.4, opacity);
    ctx.lineWidth = Math.max(1, lw * (0.3 + pass * 0.12));
    const offset = lw * (0.18 + pass * 0.08) * (pass % 2 === 0 ? 1 : -1);
    const ridge = pts.map((p, i) => {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const nx = -(next.y - prev.y);
      const ny = next.x - prev.x;
      const nlen = Math.hypot(nx, ny) || 1;
      const s = pointSeed(p, pass * 13 + i);
      const jOffset = offset * (0.7 + hash(s) * 0.5);
      return { x: p.x + (nx / nlen) * jOffset, y: p.y + (ny / nlen) * jOffset };
    });
    if (ridge.length === 1) dot(ctx, ridge[0], ctx.lineWidth / 2);
    else strokePath(ctx, ridge);
  }
  ctx.globalAlpha = 1;
};

function grainBrush(opts: { spread: number; dotScale: [number, number]; alphaRange: [number, number]; colorJitter: number; passes: number }): BrushRenderer {
  return ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
    const pts = toScreen(points, camera, viewportWidth, viewportHeight);
    const r = Math.max(2, (width * camera.zoom) / 2);
    ctx.globalCompositeOperation = "source-over";
    let i = 0;
    walk(pts, Math.max(2, r * 0.35), (p) => {
      for (let g = 0; g < opts.passes; g++) {
        const s = pointSeed(p, i * 31 + g);
        const angle = hash(s * 7) * Math.PI * 2;
        const dist = hash(s * 13) * r * opts.spread;
        const gx = p.x + Math.cos(angle) * dist;
        const gy = p.y + Math.sin(angle) * dist;
        const dr = opts.dotScale[0] + hash(s * 17) * (opts.dotScale[1] - opts.dotScale[0]);
        const alpha = opts.alphaRange[0] + hash(s * 23) * (opts.alphaRange[1] - opts.alphaRange[0]);
        const shadeAmount = (hash(s * 29) - 0.5) * opts.colorJitter;
        setAlpha(ctx, alpha, opacity);
        ctx.fillStyle = shade(color, shadeAmount, 1);
        dot(ctx, { x: gx, y: gy }, dr);
      }
      i++;
    });
    ctx.globalAlpha = 1;
  };
}

const chalk: BrushRenderer = grainBrush({
  spread: 0.9,
  dotScale: [0.5, 1.6],
  alphaRange: [0.25, 0.6],
  colorJitter: 40,
  passes: 5,
});

const charcoal: BrushRenderer = grainBrush({
  spread: 0.7,
  dotScale: [0.6, 2.2],
  alphaRange: [0.35, 0.8],
  colorJitter: 55,
  passes: 4,
});

const SPARKLE_COLORS = ["#ffffff", "#ffe680", "#fff6c9"];
const glitter: BrushRenderer = ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
  const pts = toScreen(points, camera, viewportWidth, viewportHeight);
  const r = Math.max(1.5, (width * camera.zoom) / 2);
  configureContext(ctx);
  // Faint base line so it reads as a stroke, not just scattered dust.
  setAlpha(ctx, 0.25, opacity);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, r * 0.6);
  if (pts.length > 1) strokePath(ctx, pts);
  let i = 0;
  walk(pts, Math.max(3, r * 0.8), (p) => {
    const s = pointSeed(p, i);
    if (hash(s) > 0.55) {
      i++;
      return;
    }
    const angle = hash(s * 3) * Math.PI * 2;
    const dist = hash(s * 5) * r * 1.4;
    const sx = p.x + Math.cos(angle) * dist;
    const sy = p.y + Math.sin(angle) * dist;
    const size = 0.8 + hash(s * 7) * r * 0.9;
    const sparkleColor = SPARKLE_COLORS[Math.floor(hash(s * 11) * SPARKLE_COLORS.length)];
    setAlpha(ctx, 0.6 + hash(s * 13) * 0.4, opacity);
    ctx.fillStyle = sparkleColor;
    // Tiny 4-point star: two crossed diamonds read as a sparkle at small sizes.
    ctx.beginPath();
    ctx.moveTo(sx, sy - size);
    ctx.lineTo(sx + size * 0.32, sy - size * 0.32);
    ctx.lineTo(sx + size, sy);
    ctx.lineTo(sx + size * 0.32, sy + size * 0.32);
    ctx.lineTo(sx, sy + size);
    ctx.lineTo(sx - size * 0.32, sy + size * 0.32);
    ctx.lineTo(sx - size, sy);
    ctx.lineTo(sx - size * 0.32, sy - size * 0.32);
    ctx.closePath();
    ctx.fill();
    i++;
  });
  ctx.globalAlpha = 1;
};

const neonGlow: BrushRenderer = ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
  const pts = toScreen(points, camera, viewportWidth, viewportHeight);
  configureContext(ctx);
  const lw = Math.max(1, width * camera.zoom);
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = lw * 2.2;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  setAlpha(ctx, 0.9, opacity);
  ctx.lineWidth = lw;
  if (pts.length === 1) dot(ctx, pts[0], lw / 2);
  else strokePath(ctx, pts);
  // Second glow pass builds up brightness where the stroke overlaps itself.
  if (pts.length > 1) strokePath(ctx, pts);
  ctx.restore();
  // Bright core on top, no shadow, so the center reads hot rather than hazy.
  setAlpha(ctx, 1, opacity);
  ctx.strokeStyle = shade(color, 90, 1);
  ctx.fillStyle = shade(color, 90, 1);
  ctx.lineWidth = Math.max(0.75, lw * 0.35);
  if (pts.length === 1) dot(ctx, pts[0], ctx.lineWidth / 2);
  else strokePath(ctx, pts);
};

// Fixed screen-space dot grid (not stroke-relative), like real Ben-Day
// halftone printing — dots line up into a consistent grid across the whole
// stroke regardless of its angle, rather than each segment having its own
// locally-rotated dot pattern.
const halftone: BrushRenderer = ({ ctx, camera, viewportWidth, viewportHeight, points, color, width, opacity }) => {
  const pts = toScreen(points, camera, viewportWidth, viewportHeight);
  const r = Math.max(2, (width * camera.zoom) / 2);
  const gridSize = Math.max(3, r * 0.9);
  const dotRadius = gridSize * 0.42;

  configureContext(ctx);
  setAlpha(ctx, 0.9, opacity);
  ctx.fillStyle = color;

  const stamped = new Set<string>();
  const stampNear = (p: Point) => {
    const minGX = Math.floor((p.x - r) / gridSize);
    const maxGX = Math.ceil((p.x + r) / gridSize);
    const minGY = Math.floor((p.y - r) / gridSize);
    const maxGY = Math.ceil((p.y + r) / gridSize);
    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gy = minGY; gy <= maxGY; gy++) {
        const cx = gx * gridSize;
        const cy = gy * gridSize;
        if (Math.hypot(cx - p.x, cy - p.y) > r) continue;
        const key = `${gx},${gy}`;
        if (stamped.has(key)) continue;
        stamped.add(key);
        dot(ctx, { x: cx, y: cy }, dotRadius);
      }
    }
  };

  if (pts.length === 1) stampNear(pts[0]);
  else walk(pts, Math.max(2, r * 0.5), stampNear);
  ctx.globalAlpha = 1;
};

export const BRUSH_RENDERERS: Record<BrushType, BrushRenderer> = {
  brush,
  pencil,
  marker,
  highlighter,
  calligraphy,
  pixel,
  watercolor,
  oilPaint,
  chalk,
  charcoal,
  glitter,
  neonGlow,
  halftone,
};

export function renderBrushStroke(brushType: BrushType | undefined, args: BrushRenderArgs) {
  const renderer = BRUSH_RENDERERS[brushType ?? "brush"] ?? brush;
  renderer(args);
}

export const BRUSH_CATALOG: Array<{ type: BrushType; label: string; category: "Basic" | "Artistic" | "Effects" }> = [
  { type: "brush", label: "Brush", category: "Basic" },
  { type: "pencil", label: "Pencil", category: "Basic" },
  { type: "marker", label: "Marker", category: "Basic" },
  { type: "highlighter", label: "Highlighter", category: "Basic" },
  { type: "calligraphy", label: "Calligraphy", category: "Basic" },
  { type: "pixel", label: "Pixel", category: "Basic" },
  { type: "watercolor", label: "Watercolor", category: "Artistic" },
  { type: "oilPaint", label: "Oil Paint", category: "Artistic" },
  { type: "chalk", label: "Chalk", category: "Artistic" },
  { type: "charcoal", label: "Charcoal", category: "Artistic" },
  { type: "glitter", label: "Glitter", category: "Effects" },
  { type: "neonGlow", label: "Neon Glow", category: "Effects" },
  { type: "halftone", label: "Halftone", category: "Effects" },
];
