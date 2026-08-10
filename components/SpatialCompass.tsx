"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChromeRivet } from "./ChromeRivet";
import type { Camera } from "@/lib/camera";
import { WORLD_WIDTH, WORLD_HEIGHT } from "@/convex/constants";
import { t, type Locale } from "@/lib/i18n";
import type { Point } from "@/lib/types";

export interface SpatialCompassProps {
  camera: Camera;
  onTeleport: (pt: Point, label: string) => void;
  locale: Locale;
}

export function SpatialCompass({ camera, onTeleport, locale }: SpatialCompassProps) {
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

  const originX = WORLD_WIDTH / 2;
  const originY = WORLD_HEIGHT / 2;

  const dx = camera.x - originX;
  const dy = camera.y - originY;
  const distance = Math.round(Math.hypot(dx, dy));
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = Math.round((angleRad * 180) / Math.PI + 90);

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (window.innerWidth >= 1360) {
        const top = Math.max(12, Math.min(rect.top, window.innerHeight - 300));
        const right = window.innerWidth - rect.left + 12;
        setCoords({ top, right });
      } else {
        setCoords({ top: 80, right: Math.max(12, window.innerWidth - rect.right) });
      }
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border border-chrome-border bg-chrome-bg-raised/90 px-2 py-1 font-mono text-xs font-semibold text-ink shadow-sm transition-colors hover:border-rust hover:text-accent-yellow"
        title={t(locale, "compass_title")}
        aria-label={t(locale, "compass_title")}
        aria-expanded={isOpen}
      >
        <span
          className="inline-block transition-transform duration-300"
          style={{ transform: `rotate(${angleDeg}deg)` }}
        >
          🧩
        </span>
        <span className="font-mono text-xs font-bold text-accent-yellow">
          {distance === 0 ? t(locale, "center").toUpperCase() : `${distance}px`}
        </span>
      </button>

      {isOpen && mounted && coords && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label={t(locale, "compass_title")}
          className="fixed z-[1000] flex flex-col gap-2.5 rounded-sm border-2 border-rust bg-chrome-bg/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.95)] backdrop-blur-md w-[260px] max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-4rem)] overflow-y-auto"
          style={{ top: `${coords.top}px`, right: `${coords.right}px` }}
        >
          <ChromeRivet className="top-2 left-2" />
          <ChromeRivet className="top-2 right-2" />

          <div className="border-b border-chrome-border/60 pb-1">
            <h3 className="font-mono text-xs font-bold uppercase text-accent-yellow">
              {t(locale, "compass_title")}
            </h3>
            <p className="font-mono text-[10px] text-ink-dim">
              Relative to Center Origin ({originX.toLocaleString()}, {originY.toLocaleString()})
            </p>
          </div>

          <div className="flex items-center justify-between font-mono text-xs text-ink-dim">
            <span>{t(locale, "distance_to_origin")}</span>
            <span className="font-bold text-accent-yellow">{distance} px</span>
          </div>

          {/* Cardinal Teleport Grid */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            <div />
            <button
              type="button"
              onClick={() => {
                onTeleport({ x: originX, y: 1000 }, "North Edge");
                setIsOpen(false);
              }}
              className="rounded border border-chrome-border bg-chrome-bg-raised py-1 text-center font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow"
              title="Teleport North"
            >
              ⬆️ N
            </button>
            <div />

            <button
              type="button"
              onClick={() => {
                onTeleport({ x: 1000, y: originY }, "West Edge");
                setIsOpen(false);
              }}
              className="rounded border border-chrome-border bg-chrome-bg-raised py-1 text-center font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow"
              title="Teleport West"
            >
              ⬅️ W
            </button>

            <button
              type="button"
              onClick={() => {
                onTeleport({ x: originX, y: originY }, "Center Origin");
                setIsOpen(false);
              }}
              className="rounded border border-rust bg-rust/30 py-1 text-center font-mono text-xs font-bold text-accent-yellow hover:bg-rust/50"
              title="Teleport Center Origin"
            >
              🌐 {t(locale, "origin").toUpperCase()}
            </button>

            <button
              type="button"
              onClick={() => {
                onTeleport({ x: WORLD_WIDTH - 1000, y: originY }, "East Edge");
                setIsOpen(false);
              }}
              className="rounded border border-chrome-border bg-chrome-bg-raised py-1 text-center font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow"
              title="Teleport East"
            >
              ➡️ E
            </button>

            <div />
            <button
              type="button"
              onClick={() => {
                onTeleport({ x: originX, y: WORLD_HEIGHT - 1000 }, "South Edge");
                setIsOpen(false);
              }}
              className="rounded border border-chrome-border bg-chrome-bg-raised py-1 text-center font-mono text-xs font-bold text-ink hover:border-rust hover:text-accent-yellow"
              title="Teleport South"
            >
              ⬇️ S
            </button>
            <div />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
