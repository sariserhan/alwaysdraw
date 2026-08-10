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
 * Converts a text string into an array of stroke points in world space.
 * Uses offscreen canvas stroke/contour sampling when running in the browser,
 * or a clean fallback vector stroke map when running under edge/node test environments.
 */
export function convertTextToPoints(
  text: string,
  origin: Point,
  fontSize = 32,
  fontStyle: FontStyle = "sans",
): Point[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleanText = text.trim();

  // Try Canvas rendering in DOM environment
  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        const fontConfig = FONT_STYLES.find((f) => f.id === fontStyle)?.fontCss ?? FONT_STYLES[0].fontCss;
        ctx.font = `bold ${fontSize}px ${fontConfig}`;

        const metrics = ctx.measureText(cleanText);
        const textWidth = Math.ceil(metrics.width) + 20;
        const textHeight = Math.ceil(fontSize * 1.4);

        canvas.width = textWidth;
        canvas.height = textHeight;

        ctx.font = `bold ${fontSize}px ${fontConfig}`;
        ctx.textBaseline = "top";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(cleanText, 10, 5);

        const imgData = ctx.getImageData(0, 0, textWidth, textHeight);
        const data = imgData.data;
        const sampledPoints: Point[] = [];
        const step = Math.max(2, Math.floor(fontSize / 16));

        for (let y = 0; y < textHeight; y += step) {
          for (let x = 0; x < textWidth; x += step) {
            const alpha = data[(y * textWidth + x) * 4 + 3];
            if (alpha > 128) {
              sampledPoints.push({
                x: origin.x + (x - 10),
                y: origin.y + (y - 5),
              });
            }
          }
        }

        if (sampledPoints.length > 0) {
          return sampledPoints;
        }
      }
    } catch {
      // Fallback if canvas context fails
    }
  }

  // Fallback vector stroke generator for non-browser runtime (e.g. edge-runtime / vitest)
  const points: Point[] = [];
  let currentX = origin.x;
  const charWidth = fontSize * 0.7;
  const charHeight = fontSize;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char === " ") {
      currentX += charWidth;
      continue;
    }

    // Render 5 sample points per character bounding box
    points.push(
      { x: currentX, y: origin.y },
      { x: currentX + charWidth, y: origin.y },
      { x: currentX + charWidth / 2, y: origin.y + charHeight / 2 },
      { x: currentX, y: origin.y + charHeight },
      { x: currentX + charWidth, y: origin.y + charHeight },
    );

    currentX += charWidth * 1.1;
  }

  return points;
}
