"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Camera } from "@/lib/camera";
import { worldToScreen } from "@/lib/coordinates";
import type { Point } from "@/lib/types";

export interface ProtectedZonesOverlayProps {
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
  onDeleteZone?: (zoneId: string) => void;
  isAdmin?: boolean;
}

export interface ProtectedZonesOverlayHandle {
  /** Same fix as CommentsOverlay/RemoteCursors: `camera` prop-driven
   * positioning lags cameraRef by up to one frame during continuous pan/zoom,
   * which worldToScreen amplifies into a visible jump at low zoom. Also
   * toggles each zone's hover badge (opacity/pointer-events) based on
   * whether the live cursor world position is inside its bounds — driven off
   * the same imperative ref writes rather than CSS :hover, since :hover
   * would need pointer-events:auto on the full zone rect, which would block
   * drawing clicks from reaching the canvas underneath. Call every frame
   * alongside the canvas's own redraw. */
  syncPositions: (
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    hoveredWorldPt: Point,
  ) => void;
}

export const ProtectedZonesOverlay = forwardRef<ProtectedZonesOverlayHandle, ProtectedZonesOverlayProps>(
  function ProtectedZonesOverlay({ camera, viewportWidth, viewportHeight, onDeleteZone, isAdmin }, ref) {
    const protectedZones = useQuery(api.admin.getProtectedZones, {});
    const boxRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const badgeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useImperativeHandle(
      ref,
      () => ({
        syncPositions(nextCamera, vw, vh, hoveredWorldPt) {
          if (!protectedZones) return;
          for (const zone of protectedZones) {
            const el = boxRefs.current.get(zone._id);
            if (el) {
              const topLeft = worldToScreen(zone.minX, zone.minY, nextCamera, vw, vh);
              const width = (zone.maxX - zone.minX) * nextCamera.zoom;
              const height = (zone.maxY - zone.minY) * nextCamera.zoom;
              el.style.left = `${topLeft.x}px`;
              el.style.top = `${topLeft.y}px`;
              el.style.width = `${width}px`;
              el.style.height = `${height}px`;
            }

            const badgeEl = badgeRefs.current.get(zone._id);
            if (badgeEl) {
              const isHovering =
                hoveredWorldPt.x >= zone.minX &&
                hoveredWorldPt.x <= zone.maxX &&
                hoveredWorldPt.y >= zone.minY &&
                hoveredWorldPt.y <= zone.maxY;
              badgeEl.style.opacity = isHovering ? "1" : "0";
              badgeEl.style.pointerEvents = isHovering ? "auto" : "none";
            }
          }
        },
      }),
      [protectedZones],
    );

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
              ref={(el) => {
                if (el) boxRefs.current.set(zone._id, el);
                else boxRefs.current.delete(zone._id);
              }}
              className="absolute rounded border-2 border-dashed border-accent-yellow bg-accent-yellow/5 shadow-[0_0_16px_rgba(255,204,0,0.25)]"
              style={{
                left: topLeft.x,
                top: topLeft.y,
                width: zoneWidth,
                height: zoneHeight,
              }}
            >
              {/* Owner badge — hidden until the cursor is over this zone (see syncPositions) */}
              <div
                ref={(el) => {
                  if (el) badgeRefs.current.set(zone._id, el);
                  else badgeRefs.current.delete(zone._id);
                }}
                className={`pointer-events-none absolute left-3 flex items-center gap-1.5 rounded-sm border border-rust bg-chrome-bg/95 px-2 py-0.5 font-mono text-[10px] font-bold text-accent-yellow shadow-md backdrop-blur-md opacity-0 ${
                  topLeft.y < 24 ? "top-1" : "-top-4"
                }`}
              >
                <span>🛡️</span>
                <span className="uppercase tracking-wider">
                  {/* Never render the raw ownerClientId here — it's the exact
                   * spoofable value (see lib/identity.ts) that lets a client
                   * bypass this zone's protection, so exposing it publicly
                   * would hand out the bypass. */}
                  {zone.ownerName ? `owned by ${zone.ownerName}` : zone.name}
                </span>
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
  },
);
