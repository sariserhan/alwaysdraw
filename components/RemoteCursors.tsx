"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { worldToScreen } from "@/lib/coordinates";
import type { Camera } from "@/lib/camera";

type CursorEntry = { clientId: string; cursorX: number; cursorY: number };

const CURSOR_COLORS = ["#e0432b", "#39c07a", "#2f9fe0", "#e0b13a", "#c14fd6"];

function colorForClient(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = (hash * 31 + clientId.charCodeAt(i)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

export interface RemoteCursorsHandle {
  /** Same fix as CommentsOverlay's syncPositions: repositions every mounted
   * cursor straight in the DOM inside the same animation-frame tick the
   * canvas redraws in, instead of waiting on the `camera` prop (one render
   * behind cameraRef during continuous pan/zoom) — that one-frame gap gets
   * amplified by worldToScreen's zoom multiplication into a visible jump
   * for a cursor far from the camera center, worst at low zoom. */
  syncPositions: (camera: Camera, viewportWidth: number, viewportHeight: number) => void;
}

export interface RemoteCursorsProps {
  entries: CursorEntry[];
  selfClientId: string;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
}

export const RemoteCursors = forwardRef<RemoteCursorsHandle, RemoteCursorsProps>(function RemoteCursors(
  { entries, selfClientId, camera, viewportWidth, viewportHeight },
  ref,
) {
  const cursorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const visibleEntries = entries.filter((e) => e.clientId !== selfClientId);

  useImperativeHandle(
    ref,
    () => ({
      syncPositions(nextCamera, vw, vh) {
        for (const e of visibleEntries) {
          const el = cursorRefs.current.get(e.clientId);
          if (!el) continue;
          const p = worldToScreen(e.cursorX, e.cursorY, nextCamera, vw, vh);
          el.style.left = `${p.x}px`;
          el.style.top = `${p.y}px`;
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {visibleEntries.map((e) => {
        const p = worldToScreen(e.cursorX, e.cursorY, camera, viewportWidth, viewportHeight);
        if (p.x < -20 || p.y < -20 || p.x > viewportWidth + 20 || p.y > viewportHeight + 20) {
          return null;
        }
        const fill = colorForClient(e.clientId);
        return (
          <div
            key={e.clientId}
            ref={(el) => {
              if (el) cursorRefs.current.set(e.clientId, el);
              else cursorRefs.current.delete(e.clientId);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/4"
            style={{ left: p.x, top: p.y }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden>
              <path
                d="M8 1c3.5 4.5 6 8.1 6 11a6 6 0 1 1-12 0c0-2.9 2.5-6.5 6-11Z"
                fill={fill}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="1"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
});
