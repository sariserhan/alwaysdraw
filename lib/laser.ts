import type { Point } from "./types";
import type { Camera } from "./camera";

export interface LaserPoint extends Point {
  timestamp: number;
}

export interface LaserTrail {
  id: string;
  color: string;
  points: LaserPoint[];
}

export const LASER_LIFETIME_MS = 1500;

/**
 * Draw active laser pointer trails on the main canvas with a neon glow gradient & temporal decay.
 */
export function drawLaserTrails(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number,
  trails: LaserTrail[],
  now: number = Date.now(),
) {
  if (trails.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const trail of trails) {
    const validPoints = trail.points.filter((p) => now - p.timestamp < LASER_LIFETIME_MS);
    if (validPoints.length < 2) continue;

    for (let i = 1; i < validPoints.length; i++) {
      const p1 = validPoints[i - 1];
      const p2 = validPoints[i];
      const age = now - p2.timestamp;
      const alpha = Math.max(0, 1 - age / LASER_LIFETIME_MS);

      if (alpha <= 0) continue;

      const s1 = {
        x: (p1.x - camera.x) * camera.zoom + viewportWidth / 2,
        y: (p1.y - camera.y) * camera.zoom + viewportHeight / 2,
      };
      const s2 = {
        x: (p2.x - camera.x) * camera.zoom + viewportWidth / 2,
        y: (p2.y - camera.y) * camera.zoom + viewportHeight / 2,
      };

      // Outer neon glow
      ctx.shadowColor = trail.color || "#39c07a";
      ctx.shadowBlur = 12 * camera.zoom;
      ctx.strokeStyle = trail.color || "#39c07a";
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = Math.max(3, 8 * camera.zoom);

      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();

      // Bright white inner core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(1, 3 * camera.zoom);

      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}
