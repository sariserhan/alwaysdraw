import type { Point, ServerStroke, BrushType } from "./types";

export interface AiDrawOptions {
  prompt: string;
  center: Point;
  color: string;
  brushType: BrushType;
  scale?: number;
}

export interface GeneratedAiStroke {
  points: Point[];
  color: string;
  brushType: BrushType;
  width: number;
  opacity: number;
}

/** Simple deterministic string hash to generate seed number */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/** Fetch dynamic vector strokes from real Gemini AI API with procedural fallback */
export async function fetchRealAiStrokes(options: AiDrawOptions): Promise<GeneratedAiStroke[]> {
  try {
    const res = await fetch("/api/ai-draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    if (!res.ok) throw new Error("API call failed");
    const data = await res.json();
    if (Array.isArray(data.strokes) && data.strokes.length > 0) {
      return data.strokes;
    }
  } catch (err) {
    console.warn("Falling back to local vector synthesis", err);
  }
  return generateAiStrokes(options);
}

/** Generate procedural vector stroke paths based on text prompt */
export function generateAiStrokes(options: AiDrawOptions): GeneratedAiStroke[] {
  const { prompt, center, color, brushType, scale = 1 } = options;
  const p = prompt.toLowerCase().trim();
  const strokes: GeneratedAiStroke[] = [];

  const cx = center.x;
  const cy = center.y;

  // 1. CASTLE / TOWER / HOUSE / FORTRESS
  if (p.includes("castle") || p.includes("house") || p.includes("tower") || p.includes("building") || p.includes("fortress")) {
    strokes.push({
      points: [
        { x: cx - 60 * scale, y: cy + 60 * scale },
        { x: cx + 60 * scale, y: cy + 60 * scale },
        { x: cx + 60 * scale, y: cy - 20 * scale },
        { x: cx - 60 * scale, y: cy - 20 * scale },
        { x: cx - 60 * scale, y: cy + 60 * scale },
      ],
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 60 * scale, y: cy - 20 * scale },
        { x: cx - 60 * scale, y: cy - 70 * scale },
        { x: cx - 40 * scale, y: cy - 70 * scale },
        { x: cx - 40 * scale, y: cy - 20 * scale },
      ],
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 65 * scale, y: cy - 70 * scale },
        { x: cx - 50 * scale, y: cy - 100 * scale },
        { x: cx - 35 * scale, y: cy - 70 * scale },
      ],
      color: "#e0432b",
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx + 40 * scale, y: cy - 20 * scale },
        { x: cx + 40 * scale, y: cy - 70 * scale },
        { x: cx + 60 * scale, y: cy - 70 * scale },
        { x: cx + 60 * scale, y: cy - 20 * scale },
      ],
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx + 35 * scale, y: cy - 70 * scale },
        { x: cx + 50 * scale, y: cy - 100 * scale },
        { x: cx + 65 * scale, y: cy - 70 * scale },
      ],
      color: "#e0432b",
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 20 * scale, y: cy + 60 * scale },
        { x: cx - 20 * scale, y: cy + 20 * scale },
        { x: cx, y: cy + 10 * scale },
        { x: cx + 20 * scale, y: cy + 20 * scale },
        { x: cx + 20 * scale, y: cy + 60 * scale },
      ],
      color: "#ffcc00",
      brushType,
      width: 4,
      opacity: 1,
    });
    return strokes;
  }

  // 2. ROCKET / SPACE / SHIP / UFO / METEOR
  if (p.includes("rocket") || p.includes("space") || p.includes("ship") || p.includes("ufo") || p.includes("meteor")) {
    strokes.push({
      points: [
        { x: cx - 25 * scale, y: cy + 50 * scale },
        { x: cx - 25 * scale, y: cy - 20 * scale },
        { x: cx, y: cy - 80 * scale },
        { x: cx + 25 * scale, y: cy - 20 * scale },
        { x: cx + 25 * scale, y: cy + 50 * scale },
        { x: cx - 25 * scale, y: cy + 50 * scale },
      ],
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    const circlePts: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      circlePts.push({
        x: cx + Math.cos(angle) * 15 * scale,
        y: cy + Math.sin(angle) * 15 * scale,
      });
    }
    strokes.push({
      points: circlePts,
      color: "#30b0c7",
      brushType: "neonGlow",
      width: 3,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 25 * scale, y: cy + 20 * scale },
        { x: cx - 50 * scale, y: cy + 60 * scale },
        { x: cx - 25 * scale, y: cy + 50 * scale },
      ],
      color: "#e0432b",
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx + 25 * scale, y: cy + 20 * scale },
        { x: cx + 50 * scale, y: cy + 60 * scale },
        { x: cx + 25 * scale, y: cy + 50 * scale },
      ],
      color: "#e0432b",
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 15 * scale, y: cy + 50 * scale },
        { x: cx - 25 * scale, y: cy + 85 * scale },
        { x: cx, y: cy + 70 * scale },
        { x: cx + 25 * scale, y: cy + 85 * scale },
        { x: cx + 15 * scale, y: cy + 50 * scale },
      ],
      color: "#ff9500",
      brushType: "neonGlow",
      width: 4,
      opacity: 1,
    });
    return strokes;
  }

  // 3. HEART / LOVE
  if (p.includes("heart") || p.includes("love") || p.includes("valentine")) {
    const heartPts: Point[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = (i / 30) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      heartPts.push({
        x: cx + x * 4 * scale,
        y: cy + y * 4 * scale,
      });
    }
    strokes.push({
      points: heartPts,
      color: "#e0432b",
      brushType: "neonGlow",
      width: 5,
      opacity: 1,
    });
    return strokes;
  }

  // 4. CAR / VEHICLE / TRUCK
  if (p.includes("car") || p.includes("vehicle") || p.includes("truck") || p.includes("bus")) {
    strokes.push({
      points: [
        { x: cx - 70 * scale, y: cy + 20 * scale },
        { x: cx - 70 * scale, y: cy - 10 * scale },
        { x: cx - 40 * scale, y: cy - 10 * scale },
        { x: cx - 20 * scale, y: cy - 40 * scale },
        { x: cx + 30 * scale, y: cy - 40 * scale },
        { x: cx + 50 * scale, y: cy - 10 * scale },
        { x: cx + 70 * scale, y: cy - 10 * scale },
        { x: cx + 70 * scale, y: cy + 20 * scale },
        { x: cx - 70 * scale, y: cy + 20 * scale },
      ],
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    // Wheels
    const makeWheel = (wx: number) => {
      const pts: Point[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pts.push({ x: cx + wx + Math.cos(a) * 15 * scale, y: cy + 20 * scale + Math.sin(a) * 15 * scale });
      }
      return pts;
    };
    strokes.push({ points: makeWheel(-40 * scale), color: "#ffcc00", brushType: "neonGlow", width: 4, opacity: 1 });
    strokes.push({ points: makeWheel(40 * scale), color: "#ffcc00", brushType: "neonGlow", width: 4, opacity: 1 });
    return strokes;
  }

  // 5. TREE / FLOWER / PLANT / LEAF
  if (p.includes("tree") || p.includes("flower") || p.includes("plant") || p.includes("leaf")) {
    // Trunk
    strokes.push({
      points: [
        { x: cx - 15 * scale, y: cy + 60 * scale },
        { x: cx - 10 * scale, y: cy },
        { x: cx + 10 * scale, y: cy },
        { x: cx + 15 * scale, y: cy + 60 * scale },
      ],
      color: "#8b5a2b",
      brushType,
      width: 4,
      opacity: 1,
    });
    // Foliage Cloud
    const crownPts: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 50 + Math.sin(a * 4) * 10;
      crownPts.push({ x: cx + Math.cos(a) * r * scale, y: cy - 40 * scale + Math.sin(a) * r * scale });
    }
    strokes.push({ points: crownPts, color: "#39c07a", brushType: "neonGlow", width: 5, opacity: 1 });
    return strokes;
  }

  // 6. DIAMOND / GEM / CRYSTAL
  if (p.includes("diamond") || p.includes("gem") || p.includes("crystal")) {
    strokes.push({
      points: [
        { x: cx, y: cy - 60 * scale },
        { x: cx + 50 * scale, y: cy - 20 * scale },
        { x: cx, y: cy + 70 * scale },
        { x: cx - 50 * scale, y: cy - 20 * scale },
        { x: cx, y: cy - 60 * scale },
      ],
      color: "#30b0c7",
      brushType: "neonGlow",
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 50 * scale, y: cy - 20 * scale },
        { x: cx + 50 * scale, y: cy - 20 * scale },
      ],
      color: "#30b0c7",
      brushType: "neonGlow",
      width: 3,
      opacity: 1,
    });
    return strokes;
  }

  // 7. STAR / SUN / SPARKLE
  if (p.includes("star") || p.includes("sun") || p.includes("sparkle")) {
    const pts: Point[] = [];
    const outerR = 60 * scale;
    const innerR = 25 * scale;
    for (let i = 0; i <= 10; i++) {
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      pts.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    }
    strokes.push({
      points: pts,
      color: "#ffcc00",
      brushType: "neonGlow",
      width: 5,
      opacity: 1,
    });
    return strokes;
  }

  // 8. CAT / FACE / SMILEY / ROBOT / DOG
  if (p.includes("cat") || p.includes("face") || p.includes("robot") || p.includes("smiley") || p.includes("dog") || p.includes("bear")) {
    const headPts: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      headPts.push({
        x: cx + Math.cos(angle) * 50 * scale,
        y: cy + Math.sin(angle) * 50 * scale,
      });
    }
    strokes.push({
      points: headPts,
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 40 * scale, y: cy - 30 * scale },
        { x: cx - 50 * scale, y: cy - 75 * scale },
        { x: cx - 15 * scale, y: cy - 48 * scale },
      ],
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx + 40 * scale, y: cy - 30 * scale },
        { x: cx + 50 * scale, y: cy - 75 * scale },
        { x: cx + 15 * scale, y: cy - 48 * scale },
      ],
      color,
      brushType,
      width: 4,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx - 20 * scale, y: cy - 10 * scale },
        { x: cx - 15 * scale, y: cy - 10 * scale },
      ],
      color: "#30b0c7",
      brushType: "neonGlow",
      width: 6,
      opacity: 1,
    });
    strokes.push({
      points: [
        { x: cx + 15 * scale, y: cy - 10 * scale },
        { x: cx + 20 * scale, y: cy - 10 * scale },
      ],
      color: "#30b0c7",
      brushType: "neonGlow",
      width: 6,
      opacity: 1,
    });
    return strokes;
  }

  // =========================================================================
  // DYNAMIC PROCEDURAL GENERATOR FOR ANY UNMATCHED PROMPT
  // Derives unique geometry, petals, waveforms & accents deterministically from prompt hash
  // =========================================================================
  const seed = hashString(p);
  const numPetals = 4 + (seed % 7); // 4 to 10 sides/petals
  const radiusBase = 45 + ((seed >> 3) % 35); // 45 to 80 radius
  const harmonicFreq = 1 + ((seed >> 5) % 4);
  const accentColors = ["#e0432b", "#39c07a", "#2f9fe0", "#ffcc00", "#c14fd6", "#ff9500"];
  const accentColor = accentColors[seed % accentColors.length];

  // 1. Primary Outer Polygon / Waveform Path
  const outerPts: Point[] = [];
  const numSteps = numPetals * 4;
  for (let i = 0; i <= numSteps; i++) {
    const t = (i / numSteps) * Math.PI * 2;
    const r = (radiusBase + Math.sin(t * harmonicFreq * numPetals) * 20) * scale;
    outerPts.push({
      x: cx + Math.cos(t) * r,
      y: cy + Math.sin(t) * r,
    });
  }
  strokes.push({
    points: outerPts,
    color,
    brushType,
    width: 4,
    opacity: 1,
  });

  // 2. Inner Star / Geometry Accent
  const innerPts: Point[] = [];
  const innerCount = numPetals * 2;
  for (let i = 0; i <= innerCount; i++) {
    const angle = (i / innerCount) * Math.PI * 2;
    const r = (i % 2 === 0 ? radiusBase * 0.6 : radiusBase * 0.25) * scale;
    innerPts.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }
  strokes.push({
    points: innerPts,
    color: accentColor,
    brushType: "neonGlow",
    width: 3,
    opacity: 0.95,
  });

  // 3. Central Core Circle
  const corePts: Point[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    corePts.push({
      x: cx + Math.cos(a) * 12 * scale,
      y: cy + Math.sin(a) * 12 * scale,
    });
  }
  strokes.push({
    points: corePts,
    color: "#ffffff",
    brushType: "neonGlow",
    width: 3,
    opacity: 1,
  });

  return strokes;
}

/** Convert an HTMLImageElement or Image Data URL into vector stroke paths for live AI painting */
export function convertImageToStrokes(
  img: HTMLImageElement,
  center: Point,
  brushType: BrushType = "brush",
  targetWidth: number = 240,
): GeneratedAiStroke[] {
  const strokes: GeneratedAiStroke[] = [];
  const aspect = (img.height || 1) / (img.width || 1);
  const targetHeight = targetWidth * aspect;

  const sampleW = 50;
  const sampleH = Math.max(15, Math.round(sampleW * aspect));

  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return strokes;

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  const startX = center.x - targetWidth / 2;
  const startY = center.y - targetHeight / 2;
  const stepX = targetWidth / sampleW;
  const stepY = targetHeight / sampleH;

  // Outer Canvas Frame Outline
  strokes.push({
    points: [
      { x: startX, y: startY },
      { x: startX + targetWidth, y: startY },
      { x: startX + targetWidth, y: startY + targetHeight },
      { x: startX, y: startY + targetHeight },
      { x: startX, y: startY },
    ],
    color: "#ffcc00",
    brushType: "neonGlow",
    width: 3,
    opacity: 1,
  });

  const toHex = (r: number, g: number, b: number) =>
    `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

  // Colors within this Euclidean RGB distance are treated as "the same run" —
  // groups near-identical shades into one stroke without averaging distinct
  // colors together (the bug this replaced: one stroke per row used only its
  // first pixel's color for every point, regardless of what came after).
  const COLOR_RUN_THRESHOLD = 40;
  const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) =>
    Math.hypot(r1 - r2, g1 - g2, b1 - b2);

  // Scan line stroke builder
  for (let y = 0; y < sampleH; y += 2) {
    let currentLine: Point[] = [];
    let runColor: { r: number; g: number; b: number } | null = null;

    const flushRun = () => {
      if (currentLine.length > 1 && runColor) {
        strokes.push({
          points: currentLine,
          color: toHex(runColor.r, runColor.g, runColor.b),
          brushType,
          width: Math.max(3, Math.round(stepY * 1.8)),
          opacity: 1,
        });
      }
      currentLine = [];
      runColor = null;
    };

    for (let x = 0; x < sampleW; x += 2) {
      const idx = (y * sampleW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Skip fully transparent pixels
      if (a < 30) {
        flushRun();
        continue;
      }

      const worldX = startX + x * stepX;
      const worldY = startY + y * stepY;

      if (!runColor) {
        runColor = { r, g, b };
        currentLine = [{ x: worldX, y: worldY }];
      } else if (colorDistance(r, g, b, runColor.r, runColor.g, runColor.b) > COLOR_RUN_THRESHOLD) {
        flushRun();
        runColor = { r, g, b };
        currentLine = [{ x: worldX, y: worldY }];
      } else {
        currentLine.push({ x: worldX, y: worldY });
      }
    }

    flushRun();
  }

  return strokes;
}
