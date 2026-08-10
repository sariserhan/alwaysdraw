"use client";

import { useState } from "react";

const THEME_STORAGE_KEY = "alwaysdraw:theme";

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  // Read the attribute the blocking head script already set, so there's no
  // extra render pass just to sync the icon on mount.
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark",
  );

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore (private browsing, storage disabled)
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "switch to dark theme" : "switch to light theme"}
      title={theme === "light" ? "Switch to dark" : "Switch to light"}
      className="rounded-sm border border-chrome-border bg-chrome-bg-raised p-1.5 text-ink-dim hover:text-ink"
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
