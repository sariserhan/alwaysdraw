import type { Point } from "./types";

export const SHAPE_TYPES = ["line", "rect", "circle", "triangle"] as const;
export type ShapeType = (typeof SHAPE_TYPES)[number];

export const SHAPE_CATALOG: Array<{ type: ShapeType; label: string }> = [
  { type: "line", label: "Line" },
  { type: "rect", label: "Square" },
  { type: "circle", label: "Circle" },
  { type: "triangle", label: "Triangle" },
];

const CIRCLE_SEGMENTS = 48;

/** Drag from `start` to `end` (a bounding-box gesture) -> a closed point path for that shape. */
export function buildShapePoints(type: ShapeType, start: Point, end: Point): Point[] {
  switch (type) {
    case "line":
      return [start, end];
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
  }
}
