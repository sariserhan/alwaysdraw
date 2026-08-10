"use client";

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

export function RemoteCursors({
  entries,
  selfClientId,
  camera,
  viewportWidth,
  viewportHeight,
}: {
  entries: CursorEntry[];
  selfClientId: string;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {entries
        .filter((e) => e.clientId !== selfClientId)
        .map((e) => {
          const p = worldToScreen(e.cursorX, e.cursorY, camera, viewportWidth, viewportHeight);
          if (p.x < -20 || p.y < -20 || p.x > viewportWidth + 20 || p.y > viewportHeight + 20) {
            return null;
          }
          const fill = colorForClient(e.clientId);
          return (
            <div
              key={e.clientId}
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
}
