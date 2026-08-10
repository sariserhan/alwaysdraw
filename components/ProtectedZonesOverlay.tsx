"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/coordinates";

export interface ProtectedZonesOverlayProps {
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  onDeleteZone?: (zoneId: string) => void;
  isAdmin?: boolean;
}

export function ProtectedZonesOverlay({
  camera,
  viewportWidth,
  viewportHeight,
  onDeleteZone,
  isAdmin,
}: ProtectedZonesOverlayProps) {
  const protectedZones = useQuery(api.admin.getProtectedZones);

  if (!protectedZones || protectedZones.length === 0) return null;

  return (
    <div
      aria-label="Canvas Protected Zones"
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
    >
      {protectedZones.map((zone) => {
        const topLeft = worldToScreen(zone.minX, zone.minY, camera, viewportWidth, viewportHeight);
        const zoneWidth = (zone.maxX - zone.minX) * camera.zoom;
        const zoneHeight = (zone.maxY - zone.minY) * camera.zoom;

        // Cull zones off-screen
        if (
          topLeft.x + zoneWidth < 0 ||
          topLeft.x > viewportWidth ||
          topLeft.y + zoneHeight < 0 ||
          topLeft.y > viewportHeight
        ) {
          return null;
        }

        return (
          <div
            key={zone._id}
            className="absolute rounded border-2 border-dashed border-accent-yellow bg-accent-yellow/5 shadow-[0_0_16px_rgba(255,204,0,0.25)] transition-all"
            style={{
              left: topLeft.x,
              top: topLeft.y,
              width: zoneWidth,
              height: zoneHeight,
            }}
          >
            {/* Header Shield Badge */}
            <div className="pointer-events-auto absolute -top-4 left-3 flex items-center gap-1.5 rounded-sm border border-rust bg-chrome-bg/95 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-yellow shadow-md backdrop-blur-md">
              <span>🛡️</span>
              <span className="uppercase tracking-wider">{zone.name}</span>
              <span className="text-[9px] text-ink-dim">
                ({Math.round(zone.minX)}, {Math.round(zone.minY)}) → ({Math.round(zone.maxX)}, {Math.round(zone.maxY)})
              </span>

              {isAdmin && onDeleteZone && (
                <button
                  type="button"
                  onClick={() => onDeleteZone(zone._id)}
                  className="ml-1 rounded border border-accent-crimson/60 bg-accent-crimson/20 px-1 py-0.2 text-[9px] text-accent-crimson hover:bg-accent-crimson hover:text-on-accent transition-colors"
                  title="Remove Protection Lock"
                >
                  ✕ UNLOCK
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
