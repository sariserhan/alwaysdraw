"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChromeRivet } from "./ChromeRivet";
import { t, type Locale } from "@/lib/i18n";
import type { WorldRect } from "@/lib/types";

export interface TimeTravelMenuProps {
  isReplayMode: boolean;
  isPlaying: boolean;
  currentSequence: number;
  minSequence: number;
  maxSequence: number;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSeek: (sequence: number) => void;
  onStep: (delta: number) => void;
  onSpeedChange: (speed: number) => void;
  onExitReplay: () => void;
  onEnterReplay: () => void;
  /** Drag-selected world-space rectangle scoping replay to a region — null
   * means the whole canvas. */
  region: WorldRect | null;
  onSelectRegion: () => void;
  onClearRegion: () => void;
  locale: Locale;
}

const SPEEDS = [1, 5, 20, 100];

export function TimeTravelMenu({
  isReplayMode,
  isPlaying,
  currentSequence,
  minSequence,
  maxSequence,
  playbackSpeed,
  onTogglePlay,
  onSeek,
  onStep,
  onSpeedChange,
  onExitReplay,
  onEnterReplay,
  region,
  onSelectRegion,
  onClearRegion,
  locale,
}: TimeTravelMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      if (!isReplayMode) onEnterReplay();
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        if (window.innerWidth >= 1360) {
          const top = Math.max(12, Math.min(rect.top, window.innerHeight - 380));
          const right = window.innerWidth - rect.left + 12;
          setCoords({ top, right });
        } else {
          setCoords({ top: 80, right: Math.max(12, window.innerWidth - rect.right) });
        }
      }
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleExit = () => {
    onExitReplay();
    setIsOpen(false);
  };

  const handleSelectRegionClick = () => {
    onSelectRegion();
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isReplayMode || isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "history_replay")}
        aria-label={t(locale, "history_replay")}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-yellow">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>{t(locale, "timetravel").toUpperCase()}</span>
      </button>

      {isOpen && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          role="region"
          aria-label={t(locale, "history_replay")}
          className="fixed z-[1000] flex flex-col gap-2 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.95)] backdrop-blur-md w-[320px] sm:w-[440px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4rem)] overflow-y-auto"
          style={{ top: `${coords.top}px`, right: `${coords.right}px` }}
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-chrome-border/60 pb-2">
            <div className="flex items-center gap-2 pl-4">
              <span className="h-2 w-2 rounded-full bg-accent-yellow animate-pulse" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-accent-yellow">
                {t(locale, "history_replay").toUpperCase()}
              </span>
              <span className="font-mono text-xs text-ink-dim">
                #{currentSequence} / #{maxSequence}
              </span>
            </div>

            <button
              type="button"
              onClick={handleExit}
              className="flex items-center gap-1 whitespace-nowrap rounded-sm border border-accent-crimson/50 bg-accent-crimson/20 px-2 py-0.5 font-mono text-[11px] font-bold text-accent-crimson transition-colors hover:bg-accent-crimson hover:text-white"
              title={t(locale, "live")}
            >
              <span>{t(locale, "live").toUpperCase()}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-accent-crimson" />
            </button>
          </div>

          {/* Region scope */}
          <div className="flex items-center justify-between gap-2 rounded border border-chrome-border/60 bg-chrome-bg-raised/60 px-2 py-1.5">
            <span className="min-w-0 truncate font-mono text-[10px] text-ink-dim">
              {region
                ? `${t(locale, "region")}: ${Math.round(region.maxX - region.minX)}×${Math.round(region.maxY - region.minY)}px`
                : t(locale, "whole_canvas")}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectRegionClick}
                className="rounded border border-chrome-border bg-chrome-bg px-2 py-0.5 font-mono text-[10px] font-bold text-ink-dim transition-colors hover:border-rust hover:text-accent-yellow"
              >
                {t(locale, "select_region")}
              </button>
              {region && (
                <button
                  type="button"
                  onClick={onClearRegion}
                  className="rounded border border-chrome-border bg-chrome-bg px-2 py-0.5 font-mono text-[10px] font-bold text-ink-dim transition-colors hover:border-rust hover:text-accent-crimson"
                >
                  {t(locale, "clear_region")}
                </button>
              )}
            </div>
          </div>

          {/* Scrubber slider */}
          <div className="flex items-center gap-3 px-1">
            <span className="font-mono text-[10px] text-ink-dim">#{minSequence}</span>
            <input
              type="range"
              min={minSequence}
              max={Math.max(minSequence + 1, maxSequence)}
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
                className="flex items-center gap-1 whitespace-nowrap rounded border border-rust bg-rust/30 px-3 py-1 font-mono text-xs font-bold text-ink transition-colors hover:bg-rust hover:text-white"
                aria-label={isPlaying ? "Pause Replay" : "Play Replay"}
              >
                {isPlaying ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    <span>{t(locale, "pause").toUpperCase()}</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>{t(locale, "play").toUpperCase()}</span>
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
              <span className="mr-1 font-mono text-[10px] uppercase text-ink-dim">{t(locale, "speed")}</span>
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
        </div>,
        document.body,
      )}
    </>
  );
}
