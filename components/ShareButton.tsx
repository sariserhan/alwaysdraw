"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";

export interface ShareButtonProps {
  onShare: () => void | Promise<void>;
  locale: Locale;
}

export function ShareButton({ onShare, locale }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await onShare();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-[28px] w-full items-center justify-center gap-1 min-w-0 truncate rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold shadow-sm transition-colors ${
        copied
          ? "border-accent-green bg-accent-green text-on-accent font-bold"
          : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
      }`}
      title={copied ? "Copied link to clipboard!" : t(locale, "share")}
      aria-label={t(locale, "share")}
    >
      <span>🔗</span>
      <span className="truncate">{copied ? t(locale, "copied").toUpperCase() : t(locale, "share").toUpperCase()}</span>
    </button>
  );
}
