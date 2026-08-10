import type { Point } from "./types";

export type FontStyle = "sans" | "mono" | "pixel" | "serif" | "cursive";

export const FONT_STYLES: Array<{ id: FontStyle; label: string; fontCss: string }> = [
  { id: "sans", label: "Sans (Space Grotesk)", fontCss: "'Space Grotesk', system-ui, sans-serif" },
  { id: "mono", label: "Mono (Space Mono)", fontCss: "'Space Mono', monospace" },
  { id: "pixel", label: "Pixel / Retro", fontCss: "'Press Start 2P', 'Courier New', monospace" },
  { id: "serif", label: "Serif / Classic", fontCss: "Georgia, serif" },
  { id: "cursive", label: "Script / Cursive", fontCss: "'Comic Sans MS', cursive, sans-serif" },
];

/**
 * Normalized vector stroke definitions (0..1 bounding box) for characters.
 */
const GLYPHS: Record<string, number[][][]> = {
  A: [[[0, 1], [0.5, 0], [1, 1]], [[0.2, 0.6], [0.8, 0.6]]],
  B: [[[0, 0], [0, 1]], [[0, 0], [0.7, 0], [0.9, 0.25], [0.7, 0.5], [0, 0.5]], [[0, 0.5], [0.7, 0.5], [0.9, 0.75], [0.7, 1], [0, 1]]],
  C: [[[0.9, 0.2], [0.5, 0], [0.1, 0.3], [0.1, 0.7], [0.5, 1], [0.9, 0.8]]],
  D: [[[0, 0], [0, 1]], [[0, 0], [0.6, 0], [0.9, 0.3], [0.9, 0.7], [0.6, 1], [0, 1]]],
  E: [[[0.9, 0], [0, 0], [0, 1], [0.9, 1]], [[0, 0.5], [0.7, 0.5]]],
  F: [[[0.9, 0], [0, 0], [0, 1]], [[0, 0.5], [0.7, 0.5]]],
  G: [[[0.9, 0.2], [0.5, 0], [0.1, 0.3], [0.1, 0.7], [0.5, 1], [0.9, 0.7], [0.5, 0.7]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]],
  I: [[[0.2, 0], [0.8, 0]], [[0.5, 0], [0.5, 1]], [[0.2, 1], [0.8, 1]]],
  J: [[[0.2, 0], [0.8, 0]], [[0.6, 0], [0.6, 0.8], [0.3, 1], [0, 0.8]]],
  K: [[[0, 0], [0, 1]], [[0.9, 0], [0, 0.5], [0.9, 1]]],
  L: [[[0, 0], [0, 1], [0.9, 1]]],
  M: [[[0, 1], [0, 0], [0.5, 0.6], [1, 0], [1, 1]]],
  N: [[[0, 1], [0, 0], [1, 1], [1, 0]]],
  O: [[[0.5, 0], [0.1, 0.3], [0.1, 0.7], [0.5, 1], [0.9, 0.7], [0.9, 0.3], [0.5, 0]]],
  P: [[[0, 1], [0, 0], [0.7, 0], [0.9, 0.25], [0.7, 0.5], [0, 0.5]]],
  Q: [[[0.5, 0], [0.1, 0.3], [0.1, 0.7], [0.5, 1], [0.9, 0.7], [0.9, 0.3], [0.5, 0]], [[0.6, 0.6], [0.95, 0.95]]],
  R: [[[0, 1], [0, 0], [0.7, 0], [0.9, 0.25], [0.7, 0.5], [0, 0.5]], [[0.4, 0.5], [0.9, 1]]],
  S: [[[0.9, 0.2], [0.5, 0], [0.1, 0.3], [0.9, 0.7], [0.5, 1], [0.1, 0.8]]],
  T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
  U: [[[0, 0], [0, 0.7], [0.5, 1], [1, 0.7], [1, 0]]],
  V: [[[0, 0], [0.5, 1], [1, 0]]],
  W: [[[0, 0], [0.25, 1], [0.5, 0.4], [0.75, 1], [1, 0]]],
  X: [[[0, 0], [1, 1]], [[1, 0], [0, 1]]],
  Y: [[[0, 0], [0.5, 0.5], [1, 0]], [[0.5, 0.5], [0.5, 1]]],
  Z: [[[0, 0], [1, 0], [0, 1], [1, 1]]],
  "0": [[[0.5, 0], [0.1, 0.3], [0.1, 0.7], [0.5, 1], [0.9, 0.7], [0.9, 0.3], [0.5, 0]], [[0.2, 0.8], [0.8, 0.2]]],
  "1": [[[0.2, 0.2], [0.5, 0], [0.5, 1]], [[0.2, 1], [0.8, 1]]],
  "2": [[[0.1, 0.2], [0.5, 0], [0.9, 0.3], [0.1, 1], [0.9, 1]]],
  "3": [[[0.1, 0], [0.9, 0], [0.4, 0.45], [0.9, 0.7], [0.5, 1], [0.1, 0.8]]],
  "4": [[[0.7, 1], [0.7, 0], [0.1, 0.6], [0.9, 0.6]]],
  "5": [[[0.9, 0], [0.1, 0], [0.1, 0.45], [0.7, 0.45], [0.9, 0.7], [0.5, 1], [0.1, 0.8]]],
  "6": [[[0.9, 0.2], [0.5, 0], [0.1, 0.4], [0.1, 0.7], [0.5, 1], [0.9, 0.7], [0.5, 0.45], [0.1, 0.6]]],
  "7": [[[0, 0], [1, 0], [0.3, 1]]],
  "8": [[[0.5, 0], [0.1, 0.25], [0.5, 0.5], [0.9, 0.75], [0.5, 1], [0.1, 0.75], [0.5, 0.5], [0.9, 0.25], [0.5, 0]]],
  "9": [[[0.1, 0.8], [0.5, 1], [0.9, 0.6], [0.9, 0.3], [0.5, 0], [0.1, 0.3], [0.5, 0.55], [0.9, 0.4]]],
  "!": [[[0.5, 0], [0.5, 0.7]], [[0.5, 0.9], [0.5, 1]]],
  "?": [[[0.1, 0.25], [0.5, 0], [0.9, 0.25], [0.5, 0.55], [0.5, 0.7]], [[0.5, 0.9], [0.5, 1]]],
  ".": [[[0.45, 0.9], [0.55, 0.9], [0.55, 1], [0.45, 1], [0.45, 0.9]]],
  ",": [[[0.5, 0.8], [0.3, 1]]],
  "-": [[[0.1, 0.5], [0.9, 0.5]]],
  "+": [[[0.5, 0.1], [0.5, 0.9]], [[0.1, 0.5], [0.9, 0.5]]],
  "=": [[[0.1, 0.35], [0.9, 0.35]], [[0.1, 0.65], [0.9, 0.65]]],
  "/": [[[0.1, 1], [0.9, 0]]],
  ":": [[[0.45, 0.2], [0.55, 0.2]], [[0.45, 0.8], [0.55, 0.8]]],
  "_": [[[0, 1], [1, 1]]],
  "<": [[[0.9, 0.1], [0.1, 0.5], [0.9, 0.9]]],
  ">": [[[0.1, 0.1], [0.9, 0.5], [0.1, 0.9]]],
  "(": [[[0.8, 0], [0.2, 0.5], [0.8, 1]]],
  ")": [[[0.2, 0], [0.8, 0.5], [0.2, 1]]],
};

// Fallback box glyph for unmapped characters
const DEFAULT_GLYPH: number[][][] = [
  [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
];

/**
 * Converts a text string into clean vector stroke paths (Point[][]).
 * Each element in the outer array is a continuous stroke line path.
 */
export function convertTextToStrokePaths(
  text: string,
  origin: Point,
  fontSize = 32,
  fontStyle: FontStyle = "sans",
): Point[][] {
  if (!text || text.length === 0) {
    return [];
  }

  const paths: Point[][] = [];
  const charWidth = fontSize * 0.65;
  const charHeight = fontSize;
  const letterSpacing = fontSize * 0.2;

  let currentX = origin.x;
  let currentY = origin.y;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === "\n") {
      currentX = origin.x;
      currentY += charHeight * 1.35;
      continue;
    }

    if (char === " ") {
      currentX += charWidth * 0.8;
      continue;
    }

    const key = char.toUpperCase();
    const glyphStrokes = GLYPHS[key] ?? DEFAULT_GLYPH;

    for (const strokeDef of glyphStrokes) {
      const strokePoints: Point[] = strokeDef.map(([px, py]) => ({
        x: currentX + px * charWidth,
        y: currentY + py * charHeight,
      }));

      if (strokePoints.length >= 2) {
        paths.push(strokePoints);
      }
    }

    currentX += charWidth + letterSpacing;
  }

  return paths;
}

/**
 * Converts a text string into an array of stroke points in world space.
 */
export function convertTextToPoints(
  text: string,
  origin: Point,
  fontSize = 32,
  fontStyle: FontStyle = "sans",
): Point[] {
  const paths = convertTextToStrokePaths(text, origin, fontSize, fontStyle);
  if (paths.length === 0) return [];

  // Return flattened points for single-path consumers
  const allPoints: Point[] = [];
  for (const path of paths) {
    allPoints.push(...path);
  }
  return allPoints;
}
