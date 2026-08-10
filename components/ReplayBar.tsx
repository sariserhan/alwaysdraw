"use client";

import { ChromeRivet } from "./ChromeRivet";

export interface ReplayBarProps {
  isReplayMode: boolean;
  isPlaying: boolean;
  currentSequence: number;
  maxSequence: number;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSeek: (sequence: number) => void;
  onStep: (delta: number) => void;
  onSpeedChange: (speed: number) => void;
  onExitReplay: () => void;
  onEnterReplay: () => void;
}

const SPEEDS = [1, 5, 20, 100];

export function ReplayBar({
  isReplayMode,
  isPlaying,
  currentSequence,
  maxSequence,
  playbackSpeed,
  onTogglePlay,
  onSeek,
  onStep,
  onSpeedChange,
  onExitReplay,
  onEnterReplay,
}: ReplayBarProps) {
  if (!isReplayMode) {
    return (
      <button
        type="button"
        onClick={onEnterReplay}
        className="group relative flex items-center gap-2 rounded-sm border border-rust/70 bg-chrome-bg-raised/90 px-3 py-1.5 font-mono text-xs font-semibold tracking-wider text-ink shadow-[0_4px_12px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-colors hover:border-rust hover:bg-chrome-bg-raised hover:text-accent-yellow"
        title="Open Historical Time-Travel Replay"
        aria-label="Open Time-Travel Replay Scrubber"
      >
        <ChromeRivet className="top-1/2 left-1 -translate-y-1/2" />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="ml-1 text-accent-yellow">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>TIME TRAVEL</span>
        <ChromeRivet className="top-1/2 right-1 -translate-y-1/2" />
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Time Travel Replay Scrubber"
      className="pointer-events-auto relative flex flex-col gap-2 rounded-sm border-2 border-rust/80 bg-chrome-bg/95 p-3 shadow-[0_6px_20px_rgba(0,0,0,0.7)] backdrop-blur-md transition-all sm:min-w-[480px]"
    >
      <ChromeRivet className="top-2 left-2" />
      <ChromeRivet className="top-2 right-2" />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-chrome-border/60 pb-2">
        <div className="flex items-center gap-2 pl-4">
          <span className="h-2 w-2 rounded-full bg-accent-yellow animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent-yellow">
            HISTORY REPLAY
          </span>
          <span className="font-mono text-xs text-ink-dim">
            #{currentSequence} / #{maxSequence}
          </span>
        </div>

        <button
          type="button"
          onClick={onExitReplay}
          className="flex items-center gap-1 rounded-sm border border-accent-crimson/50 bg-accent-crimson/20 px-2 py-0.5 font-mono text-[11px] font-bold text-accent-crimson transition-colors hover:bg-accent-crimson hover:text-white"
          title="Return to Live Canvas"
        >
          <span>LIVE</span>
          <span className="h-1.5 w-1.5 rounded-full bg-accent-crimson" />
        </button>
      </div>

      {/* Scrubber slider */}
      <div className="flex items-center gap-3 px-1">
        <span className="font-mono text-[10px] text-ink-dim">#0</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, maxSequence)}
          value={currentSequence}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-sm bg-chrome-bg-raised accent-rust hover:accent-accent-yellow"
          aria-label="Replay timeline scrubber"
        />
        <span className="font-mono text-[10px] text-ink-dim">#{maxSequence}</span>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {/* Step Back */}
          <button
            type="button"
            onClick={() => onStep(-10)}
            className="rounded border border-chrome-border bg-chrome-bg-raised p-1.5 text-ink transition-colors hover:bg-chrome-bg hover:text-accent-yellow"
            title="Step back 10 strokes"
            aria-label="Step back 10 strokes"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M19 20L9 12L19 4V20Z" fill="currentColor" />
              <path d="M5 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          {/* Play/Pause */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-1 rounded border border-rust bg-rust/30 px-3 py-1 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white"
            aria-label={isPlaying ? "Pause Replay" : "Play Replay"}
          >
            {isPlaying ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Step Forward */}
          <button
            type="button"
            onClick={() => onStep(10)}
            className="rounded border border-chrome-border bg-chrome-bg-raised p-1.5 text-ink transition-colors hover:bg-chrome-bg hover:text-accent-yellow"
            title="Step forward 10 strokes"
            aria-label="Step forward 10 strokes"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 4L15 12L5 20V4Z" fill="currentColor" />
              <path d="M19 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase text-ink-dim">Speed:</span>
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => onSpeedChange(speed)}
              className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold transition-colors ${
                playbackSpeed === speed
                  ? "border border-rust bg-rust/40 text-accent-yellow"
                  : "border border-transparent text-ink-dim hover:text-ink"
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
