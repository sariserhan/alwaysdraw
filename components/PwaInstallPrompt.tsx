"use client";

import { useEffect, useState } from "react";
import { ChromeRivet } from "./ChromeRivet";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[1900] max-w-sm rounded-md border-2 border-rust bg-chrome-bg-raised/95 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
      <ChromeRivet className="top-1 left-1" />
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-accent-yellow">
          <span>📱</span>
          <span>Install AlwaysDraw App</span>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-ink-dim hover:text-ink font-mono font-bold text-sm"
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-ink-dim leading-relaxed mb-3">
        Add AlwaysDraw to your Home Screen for 1-tap full-screen drawing with instant access.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="flex-1 rounded-sm bg-accent-crimson px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-accent-crimson-deep transition-colors"
        >
          Install App
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-sm border border-chrome-border bg-chrome-bg px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-ink-dim hover:text-ink transition-colors"
        >
          Not Now
        </button>
      </div>
    </div>
  );
}
