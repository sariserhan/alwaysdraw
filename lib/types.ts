import type { BRUSH_TYPES } from "@/convex/constants";

export type StrokeMode = "draw" | "erase";
export type BrushType = (typeof BRUSH_TYPES)[number];

export type Point = { x: number; y: number };

export type LocalStroke = {
  clientStrokeId: string;
  clientId: string;
  /** Self-reported display name, snapshotted at draw time — see convex/schema.ts. */
  username?: string;
  /** ISO 3166-1 alpha-2, resolved server-side from IP; never the IP itself. */
  countryCode?: string;
  mode: StrokeMode;
  /** Only meaningful when mode === "draw"; omitted for erase strokes. */
  brushType?: BrushType;
  color: string;
  width: number;
  /** 0..1, defaults to 1 when omitted (strokes recorded before opacity existed). */
  opacity?: number;
  points: Point[];
  /** Spatial tile IDs (500x500 px cells) spanned by this stroke (e.g. ["tile_4_8"]). */
  tiles?: string[];
  clientTimestamp: number;
};

export type ServerStroke = LocalStroke & {
  sequence: number;
  serverTimestamp: number;
};

/** Tool the pointer is currently bound to — what a drag/tap on the canvas does. */
export type Tool = "brush" | "eraser" | "pan" | "magnifier" | "shape" | "ruler" | "stencil" | "laser" | "eyedropper";
