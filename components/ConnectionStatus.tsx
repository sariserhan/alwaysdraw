"use client";

import { useEffect, useRef } from "react";
import { useConvexConnectionState } from "convex/react";
import { captureEvent } from "@/lib/observability";

export function ConnectionStatus() {
  const state = useConvexConnectionState();
  const connected = state.isWebSocketConnected;
  const wasConnectedRef = useRef(false);
  const disconnectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (connected) {
      if (disconnectedAtRef.current !== null) {
        captureEvent("realtime_reconnected", {
          disconnected_ms: Math.round(performance.now() - disconnectedAtRef.current),
        });
        disconnectedAtRef.current = null;
      }
      wasConnectedRef.current = true;
      return;
    }
    if (wasConnectedRef.current && disconnectedAtRef.current === null) {
      disconnectedAtRef.current = performance.now();
      captureEvent("realtime_disconnected");
    }
  }, [connected]);

  return (
    <div className="flex items-center gap-1.5 rounded border border-chrome-border bg-chrome-bg-raised px-2.5 py-1 text-xs">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          connected
            ? "bg-accent-green shadow-[0_0_6px_var(--accent-green)]"
            : "animate-pulse bg-accent-yellow shadow-[0_0_6px_var(--accent-yellow)]"
        }`}
      />
      <span className="tracking-wide text-ink-dim uppercase">{connected ? "live" : "reconnecting"}</span>
    </div>
  );
}
