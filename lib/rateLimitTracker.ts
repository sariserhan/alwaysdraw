import { STROKES_PER_CLIENT_WINDOW, RATE_LIMIT_WINDOW_MS } from "@/convex/constants";

class RateLimitTracker {
  private timestamps: number[] = [];
  private onStatusChange?: (isWarning: boolean, count: number, resetMs: number) => void;

  public setListener(listener: (isWarning: boolean, count: number, resetMs: number) => void) {
    this.onStatusChange = listener;
  }

  public recordSubmission() {
    const now = Date.now();
    this.timestamps.push(now);
    this.clean(now);
    this.notify(now);
  }

  public recordRateLimitError() {
    const now = Date.now();
    // Simulate 120 submissions to trigger cooling warning immediately
    for (let i = 0; i < STROKES_PER_CLIENT_WINDOW; i++) {
      this.timestamps.push(now);
    }
    this.notify(now);
  }

  private clean(now: number) {
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    this.timestamps = this.timestamps.filter((ts) => ts > windowStart);
  }

  private notify(now: number) {
    this.clean(now);
    const count = this.timestamps.length;
    const isWarning = count >= STROKES_PER_CLIENT_WINDOW * 0.85; // 85% capacity threshold

    const oldest = this.timestamps[0] ?? now;
    const resetMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - oldest));

    if (this.onStatusChange) {
      this.onStatusChange(isWarning, count, resetMs);
    }
  }
}

export const rateLimitTracker = new RateLimitTracker();
