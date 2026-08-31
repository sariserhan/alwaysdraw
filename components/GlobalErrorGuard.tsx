"use client";

import { useEffect, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { captureOperationalError } from "@/lib/observability";
import { isIgnorableGlobalError } from "@/lib/globalErrorFiltering";

const SUPPORTED_LOCALES: Locale[] = ["en", "fr", "ar", "ru", "es", "pt", "tr", "ja"];

function getLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("alwaysdraw_locale") as Locale | null;
  return saved && SUPPORTED_LOCALES.includes(saved) ? saved : "en";
}

/**
 * Last-resort safety net for uncaught client-side errors — no React error
 * boundary or global handler existed before this, so any exception that
 * escaped app code (a third-party script, a message-parsing failure deep in
 * a dependency, anything genuinely unanticipated) failed completely
 * silently: no reconnect banner, no indication anything broke, just a
 * canvas that quietly stopped updating. This does not diagnose or fix the
 * underlying error — it only guarantees the user is never left staring at a
 * silently broken page with no way to recover but guessing to hit reload.
 */
export function GlobalErrorGuard() {
  const [triggered, setTriggered] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    queueMicrotask(() => setLocale(getLocale()));

    const handleError = (event: ErrorEvent) => {
      const message = event.message || event.error?.message || "";
      if (isIgnorableGlobalError(message)) return;
      captureOperationalError(event.error ?? new Error(message), "uncaught_window_error");
      setTriggered(true);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      if (isIgnorableGlobalError(message)) return;
      captureOperationalError(reason, "unhandled_promise_rejection");
      setTriggered(true);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (!triggered) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-chrome-bg/90 backdrop-blur-sm"
    >
      <div className="mx-4 flex max-w-sm flex-col items-center gap-3 rounded-sm border-2 border-rust bg-chrome-bg-raised px-6 py-5 text-center font-mono shadow-[0_12px_40px_rgba(0,0,0,0.85)]">
        <span className="text-2xl">⚠️</span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink">
          {t(locale, "global_error_title")}
        </h2>
        <p className="text-xs text-ink-dim">{t(locale, "global_error_message")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 rounded-sm border border-rust bg-rust/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-rust hover:text-white"
        >
          {t(locale, "reload")}
        </button>
      </div>
    </div>
  );
}
