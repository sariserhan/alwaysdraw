import type { Point } from "./types";
import type { ShapeType } from "./shapes";

export interface ShapeMetrics {
  label: string;
  lengthPx: number;
  angleDeg: number;
  widthPx?: number;
  heightPx?: number;
  areaPx2?: number;
}

export function calculateShapeMetrics(
  shapeType: ShapeType,
  start: Point,
  current: Point,
): ShapeMetrics {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const lengthPx = Math.round(Math.hypot(dx, dy));
  const angleRad = Math.atan2(dy, dx);
  let angleDeg = Math.round((angleRad * 180) / Math.PI);
  if (angleDeg < 0) angleDeg += 360;

  const widthPx = Math.abs(Math.round(dx));
  const heightPx = Math.abs(Math.round(dy));

  if (shapeType === "line") {
    return {
      label: `Line: ${lengthPx}px @ ${angleDeg}°`,
      lengthPx,
      angleDeg,
    };
  }

  if (shapeType === "rect") {
    const areaPx2 = widthPx * heightPx;
    return {
      label: `Rect: ${widthPx}×${heightPx}px | Area: ${areaPx2.toLocaleString()}px²`,
      lengthPx,
      angleDeg,
      widthPx,
      heightPx,
      areaPx2,
    };
  }

  if (shapeType === "circle") {
    const radius = Math.round(lengthPx / 2);
    const areaPx2 = Math.round(Math.PI * radius * radius);
    return {
      label: `Circle: R=${radius}px | Area: ${areaPx2.toLocaleString()}px²`,
      lengthPx,
      angleDeg,
      widthPx: radius * 2,
      heightPx: radius * 2,
      areaPx2,
    };
  }

  if (shapeType === "triangle") {
    const areaPx2 = Math.round((widthPx * heightPx) / 2);
    return {
      label: `Triangle: B=${widthPx}px H=${heightPx}px | Area: ${areaPx2.toLocaleString()}px²`,
      lengthPx,
      angleDeg,
      widthPx,
      heightPx,
      areaPx2,
    };
  }

  return {
    label: `${lengthPx}px @ ${angleDeg}°`,
    lengthPx,
    angleDeg,
  };
}
