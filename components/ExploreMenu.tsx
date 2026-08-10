"use client";

import { useEffect, useRef, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";
import type { Point } from "@/lib/types";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";
import { t, type Locale } from "@/lib/i18n";

export interface ExploreMenuProps {
  onJumpToPoint: (point: Point, label: string) => void;
  getBusiestPoint: () => Point | null;
  getRandomActivePoint: () => Point | null;
  getLatestActivityPoint: () => Point | null;
  onlineCount: number;
  locale: Locale;
}

const FALLBACK_CENTER: Point = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

/**
 * Was two near-identical dropdowns (SpatialDiscoveryMenu "EXPLORE" and
 * HighlightsModal "HIGHLIGHTS") — same three teleport actions duplicated
 * between them, plus a fourth ("Untouched Territory") that was never real
 * data, just a hardcoded point that drifted out of world bounds across two
 * world-size changes. One menu, three real actions, a live stats footer.
 */
export function ExploreMenu({
  onJumpToPoint,
  getBusiestPoint,
  getRandomActivePoint,
  getLatestActivityPoint,
  onlineCount,
  locale,
}: ExploreMenuProps) {
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
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const jump = (getPoint: () => Point | null, label: string) => {
    onJumpToPoint(getPoint() ?? FALLBACK_CENTER, label);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold shadow-sm transition-colors ${
          isOpen
            ? "border-rust bg-rust text-on-accent font-bold"
            : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
        }`}
        title={t(locale, "explore_wall_title")}
        aria-label={t(locale, "explore_wall_title")}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-blue">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>{t(locale, "explore").toUpperCase()}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t(locale, "explore_wall_title")}
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-3 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.85)] backdrop-blur-md w-[300px] sm:w-[360px] max-[1359px]:fixed! max-[1359px]:inset-x-3! max-[1359px]:top-20! max-[1359px]:w-auto! max-[1359px]:max-h-[calc(100vh-6rem)]! max-[1359px]:overflow-y-auto!"
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <div className="border-b border-chrome-border/60 pb-2">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">{t(locale, "explore_wall_title")}</h3>
            <p className="font-mono text-[10px] text-ink-dim">{t(locale, "explore_wall_subtitle")}</p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => jump(getBusiestPoint, t(locale, "busiest_hotspot"))}
              className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-crimson text-base font-bold">
                🔥
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold text-ink">{t(locale, "busiest_hotspot")}</span>
                <span className="font-mono text-[10px] text-ink-dim">{t(locale, "busiest_desc")}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => jump(getLatestActivityPoint, t(locale, "latest_activity"))}
              className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-green text-base font-bold">
                ⚡
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold text-ink">{t(locale, "latest_activity")}</span>
                <span className="font-mono text-[10px] text-ink-dim">{t(locale, "latest_desc")}</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => jump(getRandomActivePoint, t(locale, "random_spot"))}
              className="flex items-center gap-2.5 rounded border border-chrome-border bg-chrome-bg-raised p-2 text-left transition-colors hover:border-rust hover:bg-rust/20"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded bg-chrome-bg text-accent-blue text-base font-bold">
                🎲
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-xs font-bold text-ink">{t(locale, "random_spot")}</span>
                <span className="font-mono text-[10px] text-ink-dim">{t(locale, "random_desc")}</span>
              </div>
            </button>
          </div>

          <div className="border-t border-chrome-border/60 pt-2 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="rounded bg-chrome-bg-raised p-1.5">
              <span className="text-ink-dim block">{t(locale, "world_canvas").toUpperCase()}</span>
              <span className="font-bold text-ink">
                {(WORLD_WIDTH / 1000).toLocaleString()}k × {(WORLD_HEIGHT / 1000).toLocaleString()}k
              </span>
            </div>
            <div className="rounded bg-chrome-bg-raised p-1.5">
              <span className="text-ink-dim block">{t(locale, "active_painters").toUpperCase()}</span>
              <span className="font-bold text-accent-green">{onlineCount} {t(locale, "online")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
