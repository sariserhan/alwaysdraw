"use client";

import { useEffect, useState } from "react";
import { rateLimitTracker } from "@/lib/rateLimitTracker";
import { STROKES_PER_CLIENT_WINDOW } from "@/convex/constants";

export function RateLimitToast() {
  const [warningState, setWarningState] = useState<{
    isWarning: boolean;
    count: number;
    resetMs: number;
  }>({
    isWarning: false,
    count: 0,
    resetMs: 0,
  });

  useEffect(() => {
    rateLimitTracker.setListener((isWarning, count, resetMs) => {
      setWarningState({ isWarning, count, resetMs });
    });
  }, []);

  // Re-check once the oldest stroke in the window should have expired, so the
  // toast clears itself even if the user stops drawing (no new submissions to
  // trigger a re-evaluation otherwise).
  useEffect(() => {
    if (!warningState.isWarning) return;
    const timer = setTimeout(() => {
      rateLimitTracker.recheck();
    }, warningState.resetMs + 50);
    return () => clearTimeout(timer);
  }, [warningState.isWarning, warningState.resetMs]);

  if (!warningState.isWarning) return null;

  const pct = Math.min(100, Math.round((warningState.count / STROKES_PER_CLIENT_WINDOW) * 100));

  return (
    <div
      role="alert"
      aria-live="polite"
      className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-3 rounded-sm border-2 border-accent-yellow bg-chrome-bg/95 px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[320px] sm:w-[420px]"
    >
      <div className="flex items-center gap-2.5">
        <span className="text-lg animate-bounce">⚠️</span>
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold text-accent-yellow uppercase">
            Drawing Rate Limit Cooldown
          </span>
          <span className="font-mono text-[10px] text-ink-dim">
            {warningState.count}/{STROKES_PER_CLIENT_WINDOW} strokes in 10s window — slow down slightly
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <span className="font-mono text-xs font-bold text-accent-yellow">{pct}%</span>
        <div className="h-1.5 w-16 overflow-hidden rounded bg-chrome-bg">
          <div
            className="h-full bg-accent-yellow transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
