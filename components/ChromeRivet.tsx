/** A bolt-head: metallic highlight + recessed shadow, not a flat dot. */
export function ChromeRivet({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-2 w-2 shrink-0 rounded-full ${className}`}
      style={{
        background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.4), rgba(0,0,0,0.6) 75%)",
        boxShadow: "inset 0 1px 1.5px rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.1)",
      }}
    />
  );
}
