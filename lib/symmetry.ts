import type { Point, SymmetryMode } from "./types";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";

/**
 * Calculates symmetrical points for a given point based on symmetry mode and
 * a mirror center. Callers drawing interactively should pass the current
 * camera center (where the user is actually looking), not the world center
 * — mirroring around a fixed world point would put the mirrored copies far
 * off-screen for anyone not drawing near the exact middle of the wall.
 */
export function calculateSymmetricPoints(
  pt: Point,
  mode: SymmetryMode,
  center: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
): Point[] {
  if (mode === "off") return [pt];

  const dx = pt.x - center.x;
  const dy = pt.y - center.y;

  switch (mode) {
    case "mirror2":
      return [
        { x: pt.x, y: pt.y },
        { x: center.x - dx, y: pt.y },
      ];

    case "mirror4":
      return [
        { x: center.x + dx, y: center.y + dy },
        { x: center.x - dx, y: center.y + dy },
        { x: center.x + dx, y: center.y - dy },
        { x: center.x - dx, y: center.y - dy },
      ];

    case "mandala8": {
      const results: Point[] = [];
      const dist = Math.hypot(dx, dy);
      const baseAngle = Math.atan2(dy, dx);

      for (let i = 0; i < 8; i++) {
        const angle = baseAngle + (i * Math.PI) / 4;
        results.push({
          x: center.x + dist * Math.cos(angle),
          y: center.y + dist * Math.sin(angle),
        });
      }
      return results;
    }
  }
}
