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
 * Generates rich street-art stencil sub-paths centered at (cx, cy).
 * Each sub-path represents a clean closed outline or shape element of the stencil.
 */
export function buildStencilPoints(
  type: StencilType,
  cx: number,
  cy: number,
  size = 70,
): Point[][] {
  const paths: Point[][] = [];
  const radius = size / 2;

  switch (type) {
    case "biohazard": {
      // 3 Lobe crescents + central ring + outer ring
      const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
      for (const a of angles) {
        const subCx = cx + Math.cos(a) * (radius * 0.45);
        const subCy = cy + Math.sin(a) * (radius * 0.45);
        const circle: Point[] = [];
        for (let i = 0; i <= 24; i++) {
          const theta = (i / 24) * Math.PI * 2;
          circle.push({
            x: subCx + Math.cos(theta) * (radius * 0.45),
            y: subCy + Math.sin(theta) * (radius * 0.45),
          });
        }
        paths.push(circle);
      }
      // Central ring
      const centerRing: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const theta = (i / 24) * Math.PI * 2;
        centerRing.push({
          x: cx + Math.cos(theta) * (radius * 0.22),
          y: cy + Math.sin(theta) * (radius * 0.22),
        });
      }
      paths.push(centerRing);
      // Outer ring
      const outerRing: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const theta = (i / 24) * Math.PI * 2;
        outerRing.push({
          x: cx + Math.cos(theta) * (radius * 0.85),
          y: cy + Math.sin(theta) * (radius * 0.85),
        });
      }
      paths.push(outerRing);
      break;
    }

    case "crown": {
      // 5-Point Graffiti Crown + Base Band
      const left = cx - radius;
      const right = cx + radius;
      const top = cy - radius * 0.8;
      const midTop = cy - radius * 0.4;
      const bottom = cy + radius * 0.5;
      const baseBottom = cy + radius * 0.75;

      const crownPoints: Point[] = [
        { x: left, y: top },
        { x: cx - radius * 0.6, y: midTop },
        { x: cx - radius * 0.3, y: top * 0.85 + cy * 0.15 },
        { x: cx, y: top },
        { x: cx + radius * 0.3, y: top * 0.85 + cy * 0.15 },
        { x: cx + radius * 0.6, y: midTop },
        { x: right, y: top },
        { x: right * 0.9 + cx * 0.1, y: bottom },
        { x: left * 0.9 + cx * 0.1, y: bottom },
        { x: left, y: top },
      ];
      paths.push(crownPoints);

      // Base Band
      const band: Point[] = [
        { x: left * 0.9 + cx * 0.1, y: bottom + 4 },
        { x: right * 0.9 + cx * 0.1, y: bottom + 4 },
        { x: right * 0.9 + cx * 0.1, y: baseBottom },
        { x: left * 0.9 + cx * 0.1, y: baseBottom },
        { x: left * 0.9 + cx * 0.1, y: bottom + 4 },
      ];
      paths.push(band);

      // Crown Jewels (3 dots)
      const jewelLeft: Point[] = [];
      const jewelMid: Point[] = [];
      const jewelRight: Point[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = (i / 12) * Math.PI * 2;
        jewelLeft.push({ x: left + Math.cos(t) * 4, y: top + Math.sin(t) * 4 });
        jewelMid.push({ x: cx + Math.cos(t) * 5, y: top + Math.sin(t) * 5 });
        jewelRight.push({ x: right + Math.cos(t) * 4, y: top + Math.sin(t) * 4 });
      }
      paths.push(jewelLeft, jewelMid, jewelRight);
      break;
    }

    case "skull": {
      // Cranium dome + Jawline
      const cranium: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const theta = (i / 24) * Math.PI * 1.2 - Math.PI * 0.1;
        cranium.push({
          x: cx + Math.cos(theta - Math.PI) * (radius * 0.9),
          y: cy - radius * 0.3 + Math.sin(theta - Math.PI) * (radius * 0.9),
        });
      }
      // Jaw
      cranium.push({ x: cx + radius * 0.45, y: cy + radius * 0.8 });
      cranium.push({ x: cx - radius * 0.45, y: cy + radius * 0.8 });
      cranium.push({ x: cx - radius * 0.9, y: cy - radius * 0.1 });
      paths.push(cranium);

      // Left Eye Socket
      const leftEye: Point[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        leftEye.push({
          x: cx - radius * 0.35 + Math.cos(t) * (radius * 0.22),
          y: cy - radius * 0.1 + Math.sin(t) * (radius * 0.22),
        });
      }
      paths.push(leftEye);

      // Right Eye Socket
      const rightEye: Point[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        rightEye.push({
          x: cx + radius * 0.35 + Math.cos(t) * (radius * 0.22),
          y: cy - radius * 0.1 + Math.sin(t) * (radius * 0.22),
        });
      }
      paths.push(rightEye);

      // Nose Cavity
      const nose: Point[] = [
        { x: cx, y: cy + radius * 0.1 },
        { x: cx + radius * 0.12, y: cy + radius * 0.3 },
        { x: cx - radius * 0.12, y: cy + radius * 0.3 },
        { x: cx, y: cy + radius * 0.1 },
      ];
      paths.push(nose);

      // Teeth grid lines
      for (let tx = -0.3; tx <= 0.3; tx += 0.2) {
        paths.push([
          { x: cx + radius * tx, y: cy + radius * 0.5 },
          { x: cx + radius * tx, y: cy + radius * 0.8 },
        ]);
      }
      break;
    }

    case "arrow": {
      // Heavy spray arrow stencil
      const points: Point[] = [
        { x: cx, y: cy - radius },
        { x: cx + radius * 0.9, y: cy - radius * 0.1 },
        { x: cx + radius * 0.4, y: cy - radius * 0.1 },
        { x: cx + radius * 0.4, y: cy + radius },
        { x: cx - radius * 0.4, y: cy + radius },
        { x: cx - radius * 0.4, y: cy - radius * 0.1 },
        { x: cx - radius * 0.9, y: cy - radius * 0.1 },
        { x: cx, y: cy - radius },
      ];
      paths.push(points);
      break;
    }

    case "caution":
    case "stripes": {
      // Caution Banner Frame + Diagonal Hazard Stripes
      const left = cx - radius * 1.4;
      const right = cx + radius * 1.4;
      const top = cy - radius * 0.6;
      const bottom = cy + radius * 0.6;

      const frame: Point[] = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top },
      ];
      paths.push(frame);

      // 4 Diagonal hazard stripes inside frame
      for (let offset = -1; offset <= 1; offset += 0.6) {
        const sx1 = cx + offset * radius;
        paths.push([
          { x: sx1 - radius * 0.3, y: top },
          { x: sx1 + radius * 0.3, y: bottom },
        ]);
      }
      break;
    }

    case "approved": {
      // APPROVED Stamp Frame + Checkmark
      const left = cx - radius * 1.3;
      const right = cx + radius * 1.3;
      const top = cy - radius * 0.7;
      const bottom = cy + radius * 0.7;

      const frame: Point[] = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top },
      ];
      paths.push(frame);

      // Heavy Checkmark inside
      const checkmark: Point[] = [
        { x: cx - radius * 0.6, y: cy },
        { x: cx - radius * 0.1, y: cy + radius * 0.4 },
        { x: cx + radius * 0.7, y: cy - radius * 0.4 },
      ];
      paths.push(checkmark);
      break;
    }

    case "rivet":
    default: {
      // Rivet Outer Ring + Inner Crosshair Slot
      const outerRing: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const theta = (i / 24) * Math.PI * 2;
        outerRing.push({
          x: cx + Math.cos(theta) * radius,
          y: cy + Math.sin(theta) * radius,
        });
      }
      paths.push(outerRing);

      const innerRing: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const theta = (i / 24) * Math.PI * 2;
        innerRing.push({
          x: cx + Math.cos(theta) * (radius * 0.5),
          y: cy + Math.sin(theta) * (radius * 0.5),
        });
      }
      paths.push(innerRing);

      // Crosshair Slot
      paths.push([
        { x: cx - radius * 0.3, y: cy },
        { x: cx + radius * 0.3, y: cy },
      ]);
      paths.push([
        { x: cx, y: cy - radius * 0.3 },
        { x: cx, y: cy + radius * 0.3 },
      ]);
      break;
    }
  }

  return paths;
}
