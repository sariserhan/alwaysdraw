"use client";

import { useState } from "react";
import { t, type Locale } from "@/lib/i18n";

export interface ShareButtonProps {
  onShare: () => void | Promise<void>;
  locale?: Locale;
  iconOnly?: boolean;
}

export function ShareButton({ onShare, locale, iconOnly = false }: ShareButtonProps) {
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

  const loc = locale ?? "en";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-[28px] w-full items-center justify-center gap-1 min-w-0 rounded-sm border py-0.5 font-mono text-xs font-semibold shadow-sm transition-colors ${
        copied
          ? "border-accent-green bg-accent-green text-on-accent font-bold"
          : "border-chrome-border bg-chrome-bg-raised/90 text-ink hover:border-rust hover:text-accent-yellow"
      }`}
      title={copied ? "Copied link to clipboard!" : t(loc, "share")}
      aria-label={t(loc, "share")}
    >
      <span className="text-sm">{copied ? "✓" : "🔗"}</span>
      {!iconOnly && <span className="truncate">{copied ? t(loc, "copied").toUpperCase() : t(loc, "share").toUpperCase()}</span>}
    </button>
  );
}
