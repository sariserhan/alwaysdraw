"use client";

import { useEffect, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";

export interface InviteBannerProps {
  onDismiss?: () => void;
}

export function InviteBanner({ onDismiss }: InviteBannerProps) {
  const [visible, setVisible] = useState(false);
  const [inviter, setInviter] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref") || params.get("from");
      const hasCoords = params.has("x") && params.has("y");

      if (ref || hasCoords) {
        setInviter(ref || "A friend");
        setVisible(true);
      }
    }
  }, []);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
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
