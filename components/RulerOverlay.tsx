"use client";

import { forwardRef } from "react";

/**
 * Distance-measurement overlay: a dashed line between drag start/end plus a
 * rich industrial HUD card showing distance (px/m), angle (°), and delta coordinates.
 */
export const RulerOverlay = forwardRef<HTMLDivElement>(function RulerOverlay(_props, ref) {
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-30 hidden">
      <svg className="absolute inset-0 h-full w-full">
        <line data-ruler-line stroke="var(--accent-yellow)" strokeWidth="2" strokeDasharray="6 4" />
        <circle data-ruler-start-node r="4" fill="var(--accent-yellow)" />
        <circle data-ruler-end-node r="4" fill="var(--accent-crimson)" />
      </svg>
      <div
        data-ruler-card
        className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 rounded-sm border-2 border-rust bg-chrome-bg/95 p-2 font-mono text-xs shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md whitespace-nowrap text-ink min-w-[160px]"
      />
    </div>
  );
});
