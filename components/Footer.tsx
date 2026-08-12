"use client";

import Link from "next/link";
import { ChromeRivet } from "./ChromeRivet";

export function Footer() {
  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="relative border-t border-chrome-border bg-chrome-bg px-4 sm:px-8 pt-12 pb-8 text-ink text-sm">
      <div className="mx-auto max-w-6xl">
        {/* MAIN FOOTER GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* COLUMN 1: BRAND IDENTITY */}
          <div className="md:col-span-1 flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2 text-decoration-none group">
              <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent-crimson text-white font-mono font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
                AD
              </div>
              <span className="font-mono text-lg font-bold tracking-tight text-ink">
                AlwaysDraw<span className="text-accent-crimson">.com</span>
              </span>
            </Link>
            <p className="text-xs text-ink-dim leading-relaxed font-sans">
              One world. One canvas. Always drawing. The single shared public drawing wall live for everyone on the internet.
            </p>
            <div className="flex items-center gap-2 pt-2 text-[11px] font-mono text-ink-dim">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Real-Time WebSockets Active</span>
            </div>
          </div>

          {/* COLUMN 2: APPS & EXPERIENCES */}
          <div className="flex flex-col gap-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-yellow mb-1 flex items-center gap-1.5">
              <ChromeRivet className="relative" />
              <span>Pages &amp; Tools</span>
            </h4>
            <nav className="flex flex-col gap-2 font-mono text-xs text-ink-dim">
              <Link href="/canvas" className="hover:text-accent-yellow transition-colors">
                🎨 Live World Canvas
              </Link>
              <Link href="/draw-with-friends" className="hover:text-accent-yellow transition-colors">
                👥 Draw With Friends
              </Link>
              <Link href="/online-whiteboard" className="hover:text-accent-yellow transition-colors">
                📐 Online Whiteboard
              </Link>
              <Link href="/infinite-canvas" className="hover:text-accent-yellow transition-colors">
                🌌 Infinite Canvas
              </Link>
            </nav>
          </div>

          {/* COLUMN 3: CREATIVE TOOLS */}
          <div className="flex flex-col gap-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-yellow mb-1 flex items-center gap-1.5">
              <ChromeRivet className="relative" />
              <span>Artistic Suite</span>
            </h4>
            <ul className="flex flex-col gap-2 font-mono text-xs text-ink-dim list-none pl-0">
              <li>🖌️ 13 Texture Brushes</li>
              <li>📐 Rulers &amp; Coordinates</li>
              <li>💬 Sticky Notes &amp; Text</li>
              <li>🎥 Time-Travel Replay</li>
            </ul>
          </div>

          {/* COLUMN 4: CALL TO ACTION */}
          <div className="flex flex-col gap-3">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-yellow mb-1 flex items-center gap-1.5">
              <ChromeRivet className="relative" />
              <span>Join The Canvas</span>
            </h4>
            <p className="text-xs text-ink-dim font-sans leading-relaxed">
              No sign-up or download needed. Jump right onto the live shared wall.
            </p>
            <Link
              href="/canvas"
              className="inline-flex items-center justify-center gap-2 rounded-sm bg-accent-crimson px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent-crimson-deep transition-all"
            >
              <span>Launch Canvas</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-chrome-border/60 pt-6 text-xs font-mono text-ink-dim">
          <div>
            &copy; {new Date().getFullYear()} AlwaysDraw. All rights reserved.
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={scrollToTop}
              className="hover:text-ink transition-colors flex items-center gap-1 uppercase font-bold"
            >
              <span>Back to Top</span>
              <span>↑</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
