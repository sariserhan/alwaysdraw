"use client";

import { useState } from "react";
import { ChromeRivet } from "./ChromeRivet";

export interface ActiveGoal {
  prompt: string;
  targetX?: number;
  targetY?: number;
}

export interface DrawingChallengeWidgetProps {
  activeGoal: ActiveGoal | null;
  onAcceptChallenge?: (goal: ActiveGoal) => void;
  onDismissGoal?: () => void;
}

export function DrawingChallengeWidget({
  activeGoal,
  onAcceptChallenge,
  onDismissGoal,
}: DrawingChallengeWidgetProps) {
  const [minimized, setMinimized] = useState(false);

  if (!activeGoal) return null;

  const hasArea =
    activeGoal.targetX !== undefined &&
    activeGoal.targetY !== undefined &&
    (activeGoal.targetX !== 0 || activeGoal.targetY !== 0);

  const handleAction = () => {
    if (hasArea) {
      onAcceptChallenge?.(activeGoal);
    } else {
      onDismissGoal?.();
    }
  };

  if (minimized) {
    return (
      <div className="pointer-events-auto fixed top-16 left-4 z-40">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-1.5 rounded-full border-2 border-rust/70 bg-chrome-bg-raised/95 px-3 py-1 font-mono text-xs font-bold uppercase text-accent-yellow shadow-md backdrop-blur-md hover:border-rust hover:text-white transition-colors"
        >
          <ChromeRivet className="relative" />
          <span>🎯 Active Goal</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed top-16 left-4 z-40 max-w-xs sm:max-w-sm rounded-md border-2 border-rust bg-chrome-bg-raised/95 p-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-md text-ink animate-in slide-in-from-top-4 duration-200">
      <ChromeRivet className="top-1.5 left-1.5" />
      <ChromeRivet className="top-1.5 right-1.5" />

      <div className="flex items-center justify-between border-b border-chrome-border/70 pb-2 mb-2.5 font-mono text-xs font-bold uppercase text-accent-yellow">
        <div className="flex items-center gap-1.5">
          <span>🎯</span>
          <span>{hasArea ? "Community Drawing Goal" : "Admin Announcement Banner"}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setMinimized(true);
            onDismissGoal?.();
          }}
          className="text-ink-dim hover:text-ink text-xs font-bold px-1"
          title="Dismiss goal banner"
        >
          ✕
        </button>
      </div>

      <div className="font-display text-sm font-bold text-ink mb-3 leading-snug">
        {activeGoal.prompt}
      </div>

      <div className="flex items-center gap-2 font-mono text-xs">
        <button
          type="button"
          onClick={handleAction}
          className="w-full rounded-sm bg-accent-crimson px-3 py-2 font-bold uppercase tracking-wider text-white shadow-sm hover:bg-accent-crimson-deep transition-colors"
        >
          {hasArea ? "🎨 Teleport & Draw Goal" : "👍 OK, Got It"}
        </button>
      </div>
    </div>
  );
}
