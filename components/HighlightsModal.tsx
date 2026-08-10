"use client";

import { useEffect, useRef, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";
import type { Point } from "@/lib/types";

export interface HighlightsModalProps {
  onJumpToPoint: (pt: Point, label: string) => void;
  getBusiestPoint: () => Point | null;
  getRandomActivePoint: () => Point | null;
  onlineCount: number;
}

export function HighlightsModal({
  onJumpToPoint,
  getBusiestPoint,
  getRandomActivePoint,
  onlineCount,
}: HighlightsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleJumpBusiest = () => {
    const pt = getBusiestPoint() ?? { x: 25000, y: 25000 };
    onJumpToPoint(pt, "#1 Trending Hotspot");
    setIsOpen(false);
  };

  const handleJumpUntouched = () => {
    // Jump to quiet corner region
    onJumpToPoint({ x: 42000, y: 42000 }, "Oldest Untouched Wall");
    setIsOpen(false);
  };

  const handleJumpRandomArt = () => {
    const pt = getRandomActivePoint() ?? { x: 25000, y: 25000 };
    onJumpToPoint(pt, "Random Artwork Spot");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen
            ? "border-rust bg-rust/30 text-accent-yellow"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title="Trending Hotspots & Wall Stats"
        aria-label="Daily Highlights Menu"
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-crimson">
          <path
            d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>HIGHLIGHTS</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Daily Canvas Highlights"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-3 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[300px] sm:w-[360px]"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <div className="border-b border-chrome-border/60 pb-2">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              Daily Wall Highlights
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">
              Curated spots &amp; real-time canvas analytics
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {/* 🔥 #1 Trending Spot */}
            <button
              type="button"
              onClick={handleJumpBusiest}
              className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-crimson text-base font-bold">
                🔥
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold text-ink">#1 Trending Region</span>
                <span className="font-mono text-[10px] text-ink-dim">Highest stroke density today</span>
              </div>
            </button>

            {/* ⏳ Untouched Area */}
            <button
              type="button"
              onClick={handleJumpUntouched}
              className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-blue text-base font-bold">
                ⏳
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold text-ink">Untouched Territory</span>
                <span className="font-mono text-[10px] text-ink-dim">Quiet corner ready for fresh art</span>
              </div>
            </button>

            {/* 🎲 Random Artwork */}
            <button
              type="button"
              onClick={handleJumpRandomArt}
              className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-green text-base font-bold">
                🎲
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold text-ink">Random Art Discovery</span>
                <span className="font-mono text-[10px] text-ink-dim">Teleport to an active drawing spot</span>
              </div>
            </button>
          </div>

          {/* Wall Stats */}
          <div className="border-t border-chrome-border/60 pt-2 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="rounded bg-chrome-bg-raised p-1.5">
              <span className="text-ink-dim block">WORLD CANVAS</span>
              <span className="font-bold text-ink">50k × 50k (2.5B px)</span>
            </div>
            <div className="rounded bg-chrome-bg-raised p-1.5">
              <span className="text-ink-dim block">ACTIVE PAINTERS</span>
              <span className="font-bold text-accent-green">{onlineCount} Online</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
