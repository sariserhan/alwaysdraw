"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/types";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";

export interface SpatialDiscoveryMenuProps {
  onJumpToPoint: (point: Point, label: string) => void;
  getBusiestPoint: () => Point | null;
  getRandomActivePoint: () => Point | null;
  getLatestActivityPoint: () => Point | null;
}

export function SpatialDiscoveryMenu({
  onJumpToPoint,
  getBusiestPoint,
  getRandomActivePoint,
  getLatestActivityPoint,
}: SpatialDiscoveryMenuProps) {
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

  const handleJumpBusiest = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pt = getBusiestPoint() ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    onJumpToPoint(pt, "Busiest Hotspot");
    setIsOpen(false);
  };

  const handleJumpLatest = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pt = getLatestActivityPoint() ?? { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    onJumpToPoint(pt, "Latest Activity");
    setIsOpen(false);
  };

  const handleJumpRandom = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pt = getRandomActivePoint() ?? {
      x: Math.floor(Math.random() * WORLD_WIDTH),
      y: Math.floor(Math.random() * WORLD_HEIGHT),
    };
    onJumpToPoint(pt, "Random Art Spot");
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
        title="Spatial Teleport & Hotspots"
        aria-label="Spatial Teleport Menu"
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-blue">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>EXPLORE</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Spatial Navigation Options"
          className="absolute right-0 top-full mt-2 z-50 flex flex-col gap-1 w-48 rounded-sm border-2 border-rust bg-chrome-bg/95 p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.8)] backdrop-blur-md"
        >
          <button
            type="button"
            onClick={handleJumpBusiest}
            className="flex items-center gap-2 rounded px-2.5 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-rust/30 hover:text-accent-yellow text-left"
          >
            <span className="h-2 w-2 rounded-full bg-accent-crimson" />
            <span>Busiest Hotspot</span>
          </button>

          <button
            type="button"
            onClick={handleJumpLatest}
            className="flex items-center gap-2 rounded px-2.5 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-rust/30 hover:text-accent-green text-left"
          >
            <span className="h-2 w-2 rounded-full bg-accent-green" />
            <span>Latest Activity</span>
          </button>

          <button
            type="button"
            onClick={handleJumpRandom}
            className="flex items-center gap-2 rounded px-2.5 py-1.5 font-mono text-xs text-ink transition-colors hover:bg-rust/30 hover:text-accent-blue text-left"
          >
            <span className="h-2 w-2 rounded-full bg-accent-blue" />
            <span>Random Art Spot</span>
          </button>
        </div>
      )}
    </div>
  );
}
