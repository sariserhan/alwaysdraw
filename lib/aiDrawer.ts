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

/** Generate procedural vector stroke paths based on text prompt */
export function generateAiStrokes(options: AiDrawOptions): GeneratedAiStroke[] {
  const { prompt, center, color, brushType, scale = 1 } = options;
  const p = prompt.toLowerCase().trim();
  const strokes: GeneratedAiStroke[] = [];

  const cx = center.x;
  const cy = center.y;

  if (p.includes("castle") || p.includes("house") || p.includes("tower")) {
    // CASTLE / TOWER STROKES
    // Base wall
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
    // Left Tower & Roof
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
    // Right Tower & Roof
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
    // Door Arch
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
  } else if (p.includes("rocket") || p.includes("space") || p.includes("ship")) {
    // ROCKET STROKES
    // Rocket Body
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
    // Porthole Window
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
    // Left Fin
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
    // Right Fin
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
    // Flame
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
  } else if (p.includes("star") || p.includes("sun") || p.includes("sparkle")) {
    // 5-POINT STAR STROKES
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
  } else if (p.includes("cat") || p.includes("face") || p.includes("robot") || p.includes("smiley")) {
    // CAT / FACE STROKES
    // Head
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
    // Cat Ears
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
    // Eyes
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
    // Whiskers
    strokes.push({
      points: [{ x: cx - 20 * scale, y: cy + 10 * scale }, { x: cx - 65 * scale, y: cy + 5 * scale }],
      color,
      brushType,
      width: 3,
      opacity: 0.8,
    });
    strokes.push({
      points: [{ x: cx - 20 * scale, y: cy + 20 * scale }, { x: cx - 60 * scale, y: cy + 25 * scale }],
      color,
      brushType,
      width: 3,
      opacity: 0.8,
    });
    strokes.push({
      points: [{ x: cx + 20 * scale, y: cy + 10 * scale }, { x: cx + 65 * scale, y: cy + 5 * scale }],
      color,
      brushType,
      width: 3,
      opacity: 0.8,
    });
    strokes.push({
      points: [{ x: cx + 20 * scale, y: cy + 20 * scale }, { x: cx + 60 * scale, y: cy + 25 * scale }],
      color,
      brushType,
      width: 3,
      opacity: 0.8,
    });
  } else {
    // GENERAL PROCEDURAL MANDALA / CREATIVE SYMBOL FOR ANY PROMPT
    const numPetals = 6;
    for (let pIdx = 0; pIdx < numPetals; pIdx++) {
      const baseAngle = (pIdx / numPetals) * Math.PI * 2;
      const pts: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const r = Math.sin(t * Math.PI) * 60 * scale;
        const a = baseAngle + (t - 0.5) * 0.8;
        pts.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
        });
      }
      strokes.push({
        points: pts,
        color,
        brushType,
        width: 4,
        opacity: 1,
      });
    }

    // Outer Circle
    const circlePts: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      circlePts.push({
        x: cx + Math.cos(angle) * 70 * scale,
        y: cy + Math.sin(angle) * 70 * scale,
      });
    }
    strokes.push({
      points: circlePts,
      color: "#ffcc00",
      brushType: "neonGlow",
      width: 3,
      opacity: 1,
    });
  }

  return strokes;
}
