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
 *
 * Returns a list of sub-paths rather than one flat point list: stencils like
 * biohazard are made of several disjoint closed shapes, and a consumer that
 * draws one continuous polyline per sub-path (e.g. by submitting each as its
 * own stroke) avoids chaining a straight connector line between unrelated
 * shapes.
 */
export function buildStencilPoints(
  type: StencilType,
  cx: number,
  cy: number,
  size = 60,
): Point[][] {
  const paths: Point[][] = [];
  const radius = size / 2;

  switch (type) {
    case "biohazard": {
      // 3 overlapping circles + center ring, each its own closed sub-path
      const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
      for (const a of angles) {
        const subCx = cx + Math.cos(a) * (radius * 0.5);
        const subCy = cy + Math.sin(a) * (radius * 0.5);
        const circle: Point[] = [];
        for (let i = 0; i <= 16; i++) {
          const theta = (i / 16) * Math.PI * 2;
          circle.push({
            x: subCx + Math.cos(theta) * (radius * 0.5),
            y: subCy + Math.sin(theta) * (radius * 0.5),
          });
        }
        paths.push(circle);
      }
      break;
    }

    case "crown": {
      // 3-point crown outline (single closed sub-path)
      const left = cx - radius;
      const right = cx + radius;
      const top = cy - radius;
      const bottom = cy + radius * 0.5;

      const points: Point[] = [];
      points.push({ x: left, y: top });
      points.push({ x: cx - radius * 0.5, y: cy });
      points.push({ x: cx, y: top });
      points.push({ x: cx + radius * 0.5, y: cy });
      points.push({ x: right, y: top });
      points.push({ x: right, y: bottom });
      points.push({ x: left, y: bottom });
      points.push({ x: left, y: top });
      paths.push(points);
      break;
    }

    case "skull": {
      // Skull head + jaw line (single connected sub-path)
      const points: Point[] = [];
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
      paths.push(points);
      break;
    }

    case "arrow": {
      // Directional arrow (single closed sub-path)
      const points: Point[] = [];
      points.push({ x: cx, y: cy - radius });
      points.push({ x: cx + radius, y: cy });
      points.push({ x: cx + radius * 0.4, y: cy });
      points.push({ x: cx + radius * 0.4, y: cy + radius });
      points.push({ x: cx - radius * 0.4, y: cy + radius });
      points.push({ x: cx - radius * 0.4, y: cy });
      points.push({ x: cx - radius, y: cy });
      points.push({ x: cx, y: cy - radius });
      paths.push(points);
      break;
    }

    case "caution":
    case "stripes": {
      // Bounding box with diagonal hatch lines (single closed sub-path)
      const left = cx - radius * 1.5;
      const right = cx + radius * 1.5;
      const top = cy - radius * 0.5;
      const bottom = cy + radius * 0.5;

      const points: Point[] = [];
      points.push({ x: left, y: top });
      points.push({ x: right, y: top });
      points.push({ x: right, y: bottom });
      points.push({ x: left, y: bottom });
      points.push({ x: left, y: top });
      paths.push(points);
      break;
    }

    case "approved":
    case "rivet":
    default: {
      // Circle ring (single closed sub-path)
      const points: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const theta = (i / 24) * Math.PI * 2;
        points.push({
          x: cx + Math.cos(theta) * radius,
          y: cy + Math.sin(theta) * radius,
        });
      }
      paths.push(points);
      break;
    }
  }

  return paths;
}
