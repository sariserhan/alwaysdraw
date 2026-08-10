import type { Point } from "./types";

export const SHAPE_TYPES = ["line", "arrow", "rect", "circle", "triangle", "star", "hexagon", "heart"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

export const SHAPE_CATALOG: Array<{ type: ShapeType; label: string; icon?: string }> = [
  { type: "line", label: "Line" },
  { type: "arrow", label: "Arrow" },
  { type: "rect", label: "Square" },
  { type: "circle", label: "Circle" },
  { type: "triangle", label: "Triangle" },
  { type: "star", label: "Star" },
  { type: "hexagon", label: "Hexagon" },
  { type: "heart", label: "Heart" },
];

const CIRCLE_SEGMENTS = 48;
const HEART_SEGMENTS = 60;

/** Drag from `start` to `end` (a bounding-box gesture) -> a closed point path for that shape. */
export function buildShapePoints(type: ShapeType, start: Point, end: Point): Point[] {
  switch (type) {
    case "line":
      return [start, end];

    case "arrow": {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const angle = Math.atan2(dy, dx);
      const len = Math.hypot(dx, dy);
      const headLen = Math.min(24, Math.max(10, len * 0.3));
      const arrowAngle = 0.5; // ~28 degrees

      const leftWing = {
        x: end.x - headLen * Math.cos(angle - arrowAngle),
        y: end.y - headLen * Math.sin(angle - arrowAngle),
      };
      const rightWing = {
        x: end.x - headLen * Math.cos(angle + arrowAngle),
        y: end.y - headLen * Math.sin(angle + arrowAngle),
      };

      // Path: start -> end -> left wing -> end -> right wing
      return [start, end, leftWing, end, rightWing];
    }

    case "rect":
      return [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }, start];

    case "circle": {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const points: Point[] = [];
      for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
        const t = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
        points.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
      }
      return points;
    }

    case "triangle": {
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      const apex = { x: (minX + maxX) / 2, y: minY };
      return [apex, { x: minX, y: maxY }, { x: maxX, y: maxY }, apex];
    }

    case "star": {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const points: Point[] = [];
      const numPoints = 5;

      for (let i = 0; i <= numPoints * 2; i++) {
        const angle = (i * Math.PI) / numPoints - Math.PI / 2;
        const rFactor = i % 2 === 0 ? 1 : 0.4;
        points.push({
          x: cx + rx * rFactor * Math.cos(angle),
          y: cy + ry * rFactor * Math.sin(angle),
        });
      }
      return points;
    }

    case "hexagon": {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const points: Point[] = [];
      for (let i = 0; i <= 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 2;
        points.push({
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle),
        });
      }
      return points;
    }

    case "heart": {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const points: Point[] = [];

      for (let i = 0; i <= HEART_SEGMENTS; i++) {
        const t = (i / HEART_SEGMENTS) * Math.PI * 2;
        // Standard cardiod heart equations
        const xRaw = 16 * Math.pow(Math.sin(t), 3);
        const yRaw = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        points.push({
          x: cx + (xRaw / 16) * rx,
          y: cy + (yRaw / 17) * ry,
        });
      }
      return points;
    }
  }
}

