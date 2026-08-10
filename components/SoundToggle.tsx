"use client";

import { useState } from "react";
import { getAudioMuted, toggleAudioMuted } from "@/lib/audio";

export function SoundToggle() {
  const [muted, setMuted] = useState(() => getAudioMuted());

  const handleToggle = () => {
    const nextState = toggleAudioMuted();
    setMuted(nextState);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex h-7 w-7 items-center justify-center rounded-sm border font-mono text-xs font-bold transition-colors ${
        !muted
          ? "border-rust bg-rust/30 text-accent-yellow shadow-sm"
          : "border-chrome-border bg-chrome-bg-raised/90 text-ink-dim hover:border-rust hover:text-ink"
      }`}
      title={muted ? "Enable Audio Effects (Unmute)" : "Disable Audio Effects (Mute)"}
      aria-label={muted ? "Enable sound" : "Disable sound"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
