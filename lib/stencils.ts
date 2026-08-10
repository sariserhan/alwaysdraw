import type { Point } from "./types";

export type StencilType =
  | "biohazard"
  | "caution"
  | "rivet"
  | "crown"
  | "skull"
  | "stripes"
  | "arrow"
  | "approved";

export const STENCIL_TYPES: { id: StencilType; label: string; icon: string }[] = [
  { id: "biohazard", label: "Biohazard", icon: "☣️" },
  { id: "caution", label: "Caution Tape", icon: "⚠️" },
  { id: "rivet", label: "Chrome Rivet", icon: "⚙️" },
  { id: "crown", label: "Graffiti Crown", icon: "👑" },
  { id: "skull", label: "Skull Stencil", icon: "💀" },
  { id: "stripes", label: "Hazard Stripes", icon: "💈" },
  { id: "arrow", label: "Spray Arrow", icon: "⬆️" },
  { id: "approved", label: "Approved Stamp", icon: "🏷️" },
];

/**
 * Generates point path data for an industrial stencil centered at (cx, cy).
 */
export function buildStencilPoints(
  type: StencilType,
  cx: number,
  cy: number,
  size = 60,
): Point[] {
  const points: Point[] = [];
  const radius = size / 2;

  switch (type) {
    case "biohazard": {
      // 3 overlapping circles + center ring
      const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (const a of angles) {
        const subCx = cx + Math.cos(a) * (radius * 0.5);
        const subCy = cy + Math.sin(a) * (radius * 0.5);
        for (let i = 0; i <= 16; i++) {
          const theta = (i / 16) * Math.PI * 2;
          points.push({
            x: subCx + Math.cos(theta) * (radius * 0.5),
            y: subCy + Math.sin(theta) * (radius * 0.5),
          });
        }
      }
      break;
    }

    case "crown": {
      // 3-point crown outline
      const left = cx - radius;
      const right = cx + radius;
      const top = cy - radius;
      const bottom = cy + radius * 0.5;

      points.push({ x: left, y: top });
      points.push({ x: cx - radius * 0.5, y: cy });
      points.push({ x: cx, y: top });
      points.push({ x: cx + radius * 0.5, y: cy });
      points.push({ x: right, y: top });
      points.push({ x: right, y: bottom });
      points.push({ x: left, y: bottom });
      points.push({ x: left, y: top });
      break;
    }

    case "skull": {
      // Skull head + jaw line
      for (let i = 0; i <= 20; i++) {
        const theta = (i / 20) * Math.PI;
        points.push({
          x: cx + Math.cos(theta - Math.PI) * radius,
          y: cy - radius * 0.5 + Math.sin(theta - Math.PI) * radius,
        });
      }
      // Jaw box
      points.push({ x: cx + radius * 0.5, y: cy + radius });
      points.push({ x: cx - radius * 0.5, y: cy + radius });
      points.push({ x: cx - radius, y: cy - radius * 0.5 });
      break;
    }

    case "arrow": {
      // Directional arrow
      points.push({ x: cx, y: cy - radius });
      points.push({ x: cx + radius, y: cy });
      points.push({ x: cx + radius * 0.4, y: cy });
      points.push({ x: cx + radius * 0.4, y: cy + radius });
      points.push({ x: cx - radius * 0.4, y: cy + radius });
      points.push({ x: cx - radius * 0.4, y: cy });
      points.push({ x: cx - radius, y: cy });
      points.push({ x: cx, y: cy - radius });
      break;
    }

    case "caution":
    case "stripes": {
      // Bounding box with diagonal hatch lines
      const left = cx - radius * 1.5;
      const right = cx + radius * 1.5;
      const top = cy - radius * 0.5;
      const bottom = cy + radius * 0.5;

      points.push({ x: left, y: top });
      points.push({ x: right, y: top });
      points.push({ x: right, y: bottom });
      points.push({ x: left, y: bottom });
      points.push({ x: left, y: top });
      break;
    }

    case "approved":
    case "rivet":
    default: {
      // Circle ring
      for (let i = 0; i <= 24; i++) {
        const theta = (i / 24) * Math.PI * 2;
        points.push({
          x: cx + Math.cos(theta) * radius,
          y: cy + Math.sin(theta) * radius,
        });
      }
      break;
    }
  }

  return points;
}
