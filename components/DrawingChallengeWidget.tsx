"use client";

import { useState } from "react";
import { GHOST_PROMPTS } from "@/lib/ghostArtist";
import { ChromeRivet } from "./ChromeRivet";

export interface DrawingChallengeWidgetProps {
  onAcceptChallenge?: (prompt: string) => void;
}

export function DrawingChallengeWidget({ onAcceptChallenge }: DrawingChallengeWidgetProps) {
  const [promptIndex, setPromptIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);

  const currentPrompt = GHOST_PROMPTS[promptIndex];

  const handleNextPrompt = () => {
    setPromptIndex((prev) => (prev + 1) % GHOST_PROMPTS.length);
  };

  const handleAccept = () => {
    onAcceptChallenge?.(currentPrompt);
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
          <span>🎯 Daily Challenge</span>
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
          <span>Drawing Goal</span>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(true)}
          className="text-ink-dim hover:text-ink text-xs font-bold px-1"
          title="Minimize challenge widget"
        >
          ✕
        </button>
      </div>

      <div className="font-display text-sm font-bold text-ink mb-3 leading-snug">
        {currentPrompt}
      </div>

      <div className="flex items-center gap-2 font-mono text-xs">
        <button
          type="button"
          onClick={handleAccept}
          className="flex-1 rounded-sm bg-accent-crimson px-3 py-1.5 font-bold uppercase tracking-wider text-white shadow-sm hover:bg-accent-crimson-deep transition-colors"
        >
          🎨 Draw Here
        </button>

        <button
          type="button"
          onClick={handleNextPrompt}
          className="rounded-sm border border-chrome-border bg-chrome-bg px-2.5 py-1.5 font-bold text-ink-dim hover:text-ink transition-colors"
          title="Switch to next drawing prompt"
        >
          🎲 Next
        </button>
      </div>
    </div>
  );
}
