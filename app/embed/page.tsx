"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const GlobalCanvas = dynamic(
  () => import("@/components/GlobalCanvas").then((m) => m.GlobalCanvas),
  { ssr: false },
);

export default function EmbedPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* REFERRAL ATTRIBUTION BADGE */}
      <div className="pointer-events-auto absolute top-3 right-3 z-[1000]">
        <Link
          href="/canvas"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md border-2 border-rust bg-chrome-bg-raised/95 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-accent-yellow shadow-[0_6px_20px_rgba(0,0,0,0.6)] backdrop-blur-md hover:bg-rust hover:text-white transition-all"
        >
          <span>🎨 Draw Live on AlwaysDraw.com</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <GlobalCanvas embedded />
    </div>
  );
}
