"use client";

import { useMemo, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";
import { useHasMounted } from "@/lib/useHasMounted";

export interface InviteBannerProps {
  onDismiss?: () => void;
}

export function InviteBanner({ onDismiss }: InviteBannerProps) {
  const mounted = useHasMounted();
  const [dismissed, setDismissed] = useState(false);

  // window.location.search doesn't exist during SSR — only read it once
  // mounted. Query params don't change without a full navigation here, so a
  // one-time derive-on-mount is equivalent to the old effect-based version.
  const inviter = useMemo(() => {
    if (!mounted) return null;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || params.get("from");
    const hasCoords = params.has("x") && params.has("y");
    return ref || hasCoords ? ref || "A friend" : null;
  }, [mounted]);

  if (!inviter || dismissed) return null;

  const handleClose = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="pointer-events-auto fixed top-16 left-1/2 z-[990] flex -translate-x-1/2 items-center gap-3 rounded-md border-2 border-rust bg-chrome-bg-raised/95 px-4 py-2 text-xs font-mono font-bold tracking-wide uppercase text-ink shadow-[0_10px_30px_rgba(0,0,0,0.7)] backdrop-blur-md animate-in slide-in-from-top-4 duration-200">
      <ChromeRivet className="top-1 left-1" />
      <span className="text-base">🎨</span>
      <div>
        <span className="text-accent-yellow">{inviter}</span> invited you to co-draw in real time!
      </div>
      <button
        type="button"
        onClick={handleClose}
        className="ml-2 rounded-sm border border-chrome-border bg-chrome-bg px-2 py-0.5 text-[10px] font-bold text-ink-dim hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
