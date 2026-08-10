import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-chrome-bg px-4 py-12 text-center text-ink selection:bg-accent-crimson selection:text-on-accent">
      {/* Industrial Urban Frame / Canvas Backdrop */}
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-6 rounded-sm border-2 border-rust bg-chrome-bg-raised/95 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.85)] backdrop-blur-md sm:p-10">
        
        {/* Steel Plate Corner Rivets */}
        <div className="absolute top-3 left-3 h-2.5 w-2.5 rounded-full border border-chrome-border bg-accent-crimson shadow-sm" />
        <div className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full border border-chrome-border bg-accent-yellow shadow-sm" />
        <div className="absolute bottom-3 left-3 h-2.5 w-2.5 rounded-full border border-chrome-border bg-accent-yellow shadow-sm" />
        <div className="absolute bottom-3 right-3 h-2.5 w-2.5 rounded-full border border-chrome-border bg-accent-crimson shadow-sm" />

        {/* Big Stencil 404 Header */}
        <div className="relative flex items-center justify-center">
          <span className="stencil-cut font-display text-7xl font-black tracking-widest text-accent-crimson sm:text-8xl">
            404
          </span>
          <span className="absolute -top-2 font-mono text-xs font-bold uppercase text-accent-yellow tracking-widest bg-chrome-bg border border-rust px-2 py-0.5 rounded shadow-sm">
            ⚠ OUT OF BOUNDS
          </span>
        </div>

        {/* Description Text */}
        <div className="flex flex-col gap-2">
          <h1 className="font-mono text-base font-bold uppercase tracking-wider text-ink sm:text-lg">
            LOST IN THE YARD
          </h1>
          <p className="font-mono text-xs text-ink-dim leading-relaxed sm:text-sm">
            The wall section or coordinate vector you were looking for doesn&apos;t exist or has been painted over.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-sm border-2 border-rust bg-rust px-4 py-2.5 font-mono text-xs font-bold text-on-accent shadow-md transition-all hover:brightness-110 active:scale-95"
          >
            <span>🎨</span>
            <span>RETURN TO CANVAS</span>
          </Link>

          <Link
            href="/?x=10000&y=10000&z=100"
            className="flex flex-1 items-center justify-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg px-4 py-2.5 font-mono text-xs font-bold text-ink transition-all hover:border-rust hover:text-accent-yellow active:scale-95"
          >
            <span>🧭</span>
            <span>CENTER WALL (10k, 10k)</span>
          </Link>
        </div>

        {/* Footer Badge */}
        <div className="mt-2 border-t border-chrome-border/60 pt-3 font-mono text-[10px] text-ink-dim">
          <span>ALWAYS DRAW • 20k × 20k WORLD CANVAS</span>
        </div>
      </div>
    </div>
  );
}
