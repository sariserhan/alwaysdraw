export interface PerformanceMetrics {
  fps: number;
  frameTimeMs: number;
  visibleTiles: number;
  totalTiles: number;
  committedStrokes: number;
  memoryEstimateMb: number;
}

// ponytail: on-demand redraws (not a continuous rAF loop) mean gaps between
// tick() calls can be idle wall-clock time, not slow frames. Anything longer
// than a dropped frame or two resets the measurement window instead of being
// counted, so an idle period can't masquerade as a "1 FPS" reading.
const IDLE_GAP_MS = 250;

class FpsTracker {
  private lastTime = performance.now();
  private lastTickTime = performance.now();
  private frames = 0;
  private currentFps = 60;
  private currentFrameTime = 16.6;
  private listener?: (metrics: PerformanceMetrics) => void;

  public setListener(listener: (metrics: PerformanceMetrics) => void) {
    this.listener = listener;
  }

  public tick(visibleTiles: number, totalTiles: number, committedStrokes: number) {
    const now = performance.now();
    const sinceLastTick = now - this.lastTickTime;
    this.lastTickTime = now;

    if (sinceLastTick > IDLE_GAP_MS) {
      this.lastTime = now;
      this.frames = 0;
    }

    const delta = now - this.lastTime;
    this.frames++;

    if (delta >= 500) {
      this.currentFps = Math.round((this.frames * 1000) / delta);
      this.currentFrameTime = parseFloat((delta / this.frames).toFixed(1));
      this.frames = 0;
      this.lastTime = now;

      if (this.listener) {
        // Estimate memory usage (500x500 RGBA tiles = 1MB per tile)
        const memoryEstimateMb = parseFloat(((visibleTiles * 500 * 500 * 4) / (1024 * 1024)).toFixed(1));
        this.listener({
          fps: this.currentFps,
          frameTimeMs: this.currentFrameTime,
          visibleTiles,
          totalTiles,
          committedStrokes,
          memoryEstimateMb,
        });
      }
    }
  }
}

export const fpsTracker = new FpsTracker();
