import type { LocalStroke, Point, StrokeMode } from "./types";

const FLUSH_INTERVAL_MS = 40;
const MAX_POINTS_PER_CHUNK = 40;

function generateChunkId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Buffers points for one continuous pointer-down-to-up drag and flushes them
 * as separate ~40-point stroke chunks every ~40ms, so no single Convex
 * mutation ever carries an unbounded number of points. Consecutive chunks
 * share their boundary point so the rendered line has no gap between flushes.
 */
export class StrokeBuffer {
  private points: Point[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly clientId: string,
    public readonly mode: StrokeMode,
    public readonly color: string,
    public readonly width: number,
    private readonly onFlush: (chunk: LocalStroke) => void,
  ) {}

  addPoint(p: Point) {
    this.points.push(p);
    if (this.points.length >= MAX_POINTS_PER_CHUNK) {
      this.flush(true);
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(true), FLUSH_INTERVAL_MS);
    }
  }

  /** Flush remaining points and stop buffering (call on pointer up). */
  finish() {
    this.flush(false);
  }

  private flush(carryLastPoint: boolean) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.points.length === 0) return;
    const chunk: LocalStroke = {
      clientStrokeId: generateChunkId(),
      clientId: this.clientId,
      mode: this.mode,
      color: this.color,
      width: this.width,
      points: this.points,
      clientTimestamp: Date.now(),
    };
    this.points = carryLastPoint ? [this.points[this.points.length - 1]] : [];
    this.onFlush(chunk);
  }
}
