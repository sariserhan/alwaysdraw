"use client";

import { useEffect, useState } from "react";
import { INITIAL_GHOSTS, type GhostCursorState } from "@/lib/ghostArtist";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/coordinates";
import { ChromeRivet } from "./ChromeRivet";

export interface GhostArtistOverlayProps {
  camera: Camera;
  enabled: boolean;
  onToggleEnabled: () => void;
}

export function GhostArtistOverlay({ camera, enabled, onToggleEnabled }: GhostArtistOverlayProps) {
  const [ghosts, setGhosts] = useState<GhostCursorState[]>(INITIAL_GHOSTS);

  // Smoothly move ambient ghost cursors around
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setGhosts((prevGhosts) =>
        prevGhosts.map((g) => {
          // Wander smoothly in random direction
          const deltaX = (Math.random() - 0.5) * 60;
          const deltaY = (Math.random() - 0.5) * 60;
          const newX = g.x + deltaX;
          const newY = g.y + deltaY;

          return {
            ...g,
            x: newX,
            y: newY,
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      {/* GHOST CURSORS LAYER */}
      <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {ghosts.map((g) => {
          const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
          const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
          const screenPos = worldToScreen(g.x, g.y, camera, viewportWidth, viewportHeight);

          // Only render if within viewport
          if (
            screenPos.x < -50 ||
            screenPos.x > window.innerWidth + 50 ||
            screenPos.y < -50 ||
            screenPos.y > window.innerHeight + 50
          ) {
            return null;
          }

          return (
            <div
              key={g.id}
              className="absolute flex items-center gap-1.5 transition-all duration-1000 ease-out"
              style={{
                transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
              }}
            >
              {/* Pointer Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill={g.color} stroke="#ffffff" strokeWidth="1.5">
                <path d="M3 3l7 18 3-7 7-3L3 3z" />
              </svg>

              {/* Tag Label */}
              <div
                className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-md backdrop-blur-sm"
                style={{ backgroundColor: `${g.color}dd` }}
              >
                <span>🤖 {g.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI CO-DOODLER STATUS CONTROL PILL */}
      <div className="pointer-events-auto fixed top-16 right-4 z-40">
        <button
          type="button"
          onClick={onToggleEnabled}
          className={`flex items-center gap-2 rounded-full border-2 px-3 py-1 font-mono text-xs font-bold tracking-wide uppercase shadow-[0_4px_16px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all ${
            enabled
              ? "border-emerald-500 bg-chrome-bg-raised/95 text-emerald-400 hover:border-emerald-400"
              : "border-chrome-border bg-chrome-bg-raised/90 text-ink-dim hover:text-ink"
          }`}
          title="Toggle AI Ghost Painter to co-draw companion doodles nearby"
        >
          <ChromeRivet className="relative" />
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>🤖 AI Co-Doodler: {enabled ? "ON" : "OFF"}</span>
        </button>
      </div>
    </>
  );
}
