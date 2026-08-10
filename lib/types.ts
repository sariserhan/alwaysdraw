export type StrokeMode = "draw" | "erase";

export type Point = { x: number; y: number };

export type LocalStroke = {
  clientStrokeId: string;
  clientId: string;
  mode: StrokeMode;
  color: string;
  width: number;
  points: Point[];
  clientTimestamp: number;
};

export type ServerStroke = LocalStroke & {
  sequence: number;
  serverTimestamp: number;
};

export type Tool = "brush" | "eraser";
