"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-chrome-bg text-ink">
        <main className="border-2 border-rust bg-chrome-bg-raised p-6 shadow-[0_10px_28px_rgba(0,0,0,0.5)]">
          <h1 className="font-display text-lg font-bold tracking-wide uppercase">The wall lost connection</h1>
          <p className="mt-2 text-sm text-ink-dim">Reload to reconnect and continue drawing.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-sm bg-accent-crimson-deep px-4 py-2 text-sm font-bold text-on-accent uppercase"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
