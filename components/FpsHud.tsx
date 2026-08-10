"use client";

import { useEffect, useState } from "react";
import { fpsTracker, type PerformanceMetrics } from "@/lib/fpsTracker";
import { ChromeRivet } from "./ChromeRivet";

export function FpsHud({ isOpen }: { isOpen: boolean }) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTimeMs: 16.6,
    visibleTiles: 1,
    totalTiles: 10000,
    committedStrokes: 0,
    memoryEstimateMb: 1.0,
  });

  useEffect(() => {
    fpsTracker.setListener((m) => setMetrics(m));
  }, []);

  if (!isOpen) return null;

  const isLowFps = metrics.fps < 45;

  return (
    <div
      role="region"
      aria-label="Performance Profiler HUD"
      className="pointer-events-none fixed bottom-14 left-4 z-40 flex flex-col gap-1.5 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[220px]"
    >
      <ChromeRivet className="top-1.5 left-1.5" />
      <ChromeRivet className="top-1.5 right-1.5" />

      <div className="border-b border-chrome-border/60 pb-1">
        <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
          Performance Profiler
        </h3>
        <p className="font-mono text-[9px] text-ink-dim">
          60 FPS Frame &amp; Memory Metrics
        </p>
      </div>

      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-ink-dim">Frame Rate:</span>
        <span
          className={`font-bold ${
            isLowFps ? "text-accent-crimson-deep" : "text-accent-yellow"
          }`}
        >
          {metrics.fps} FPS ({metrics.frameTimeMs}ms)
        </span>
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-ink-dim">
        <span>Active Tiles:</span>
        <span className="font-bold text-ink">
          {metrics.visibleTiles} / {metrics.totalTiles}
        </span>
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-ink-dim">
        <span>Tile VRAM:</span>
        <span className="font-bold text-ink">{metrics.memoryEstimateMb} MB</span>
      </div>

      <div className="flex items-center justify-between font-mono text-xs text-ink-dim">
        <span>Committed Marks:</span>
        <span className="font-bold text-ink">{metrics.committedStrokes}</span>
      </div>
    </div>
  );
}
