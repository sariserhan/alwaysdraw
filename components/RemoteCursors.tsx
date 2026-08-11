"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { worldToScreen } from "@/lib/coordinates";
import type { Camera } from "@/lib/camera";

type CursorEntry = { clientId: string; cursorX: number; cursorY: number };

const CURSOR_COLORS = ["#e0432b", "#39c07a", "#2f9fe0", "#e0b13a", "#c14fd6"];

// Matches the heartbeat interval (GlobalCanvas.tsx's setInterval(send, 3000))
// so a cursor finishes gliding to its latest known position right as the
// next update lands, instead of snapping there the instant it arrives.
const LERP_DURATION_MS = 3000;

type LerpState = { fromX: number; fromY: number; toX: number; toY: number; startedAt: number };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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
  const lerpRefs = useRef<Map<string, LerpState>>(new Map());
  const visibleEntries = entries.filter((e) => e.clientId !== selfClientId);

  // A new presence snapshot landed (heartbeat) — start a fresh glide from
  // wherever the cursor visually is right now toward the new target, instead
  // of snapping. syncPositions (below) advances that glide every frame.
  useEffect(() => {
    const now = performance.now();
    for (const e of visibleEntries) {
      const prev = lerpRefs.current.get(e.clientId);
      if (!prev) {
        lerpRefs.current.set(e.clientId, { fromX: e.cursorX, fromY: e.cursorY, toX: e.cursorX, toY: e.cursorY, startedAt: now });
        continue;
      }
      if (prev.toX === e.cursorX && prev.toY === e.cursorY) continue;
      const t = Math.min(1, (now - prev.startedAt) / LERP_DURATION_MS);
      lerpRefs.current.set(e.clientId, {
        fromX: lerp(prev.fromX, prev.toX, t),
        fromY: lerp(prev.fromY, prev.toY, t),
        toX: e.cursorX,
        toY: e.cursorY,
        startedAt: now,
      });
    }
    const stillPresent = new Set(visibleEntries.map((e) => e.clientId));
    for (const clientId of lerpRefs.current.keys()) {
      if (!stillPresent.has(clientId)) lerpRefs.current.delete(clientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  useImperativeHandle(
    ref,
    () => ({
      syncPositions(nextCamera, vw, vh) {
        const now = performance.now();
        for (const e of visibleEntries) {
          const el = cursorRefs.current.get(e.clientId);
          if (!el) continue;
          const lerpState = lerpRefs.current.get(e.clientId);
          const t = lerpState ? Math.min(1, (now - lerpState.startedAt) / LERP_DURATION_MS) : 1;
          const x = lerpState ? lerp(lerpState.fromX, lerpState.toX, t) : e.cursorX;
          const y = lerpState ? lerp(lerpState.fromY, lerpState.toY, t) : e.cursorY;
          const p = worldToScreen(x, y, nextCamera, vw, vh);
          el.style.left = `${p.x - 3}px`;
          el.style.top = `${p.y - 3}px`;
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
        if (p.x < -30 || p.y < -30 || p.x > viewportWidth + 30 || p.y > viewportHeight + 30) {
          return null;
        }
        const fill = colorForClient(e.clientId);
        const shortId = e.clientId.slice(-4).toUpperCase();
        return (
          <div
            key={e.clientId}
            ref={(el) => {
              if (el) cursorRefs.current.set(e.clientId, el);
              else cursorRefs.current.delete(e.clientId);
            }}
            className="absolute flex items-center gap-1 pointer-events-none drop-shadow-md"
            style={{ left: p.x - 3, top: p.y - 3 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 3l7 18 3.75-7.5L21 10 3 3z"
                fill={fill}
                stroke="#121315"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="rounded-sm border border-black/40 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-sm opacity-90 backdrop-blur-sm whitespace-nowrap"
              style={{ backgroundColor: fill }}
            >
              #{shortId}
            </span>
          </div>
        );
      })}
    </div>
  );
});
