"use client";

import dynamic from "next/dynamic";

// The whole app is one imperative <canvas> plus client-only state (camera,
// websocket connection, anonymous identity from localStorage) — nothing
// about it is meaningful to server-render, and SSR-ing it just invites
// hydration mismatches against browser-only state. Skip SSR entirely.
const GlobalCanvas = dynamic(
  () => import("@/components/GlobalCanvas").then((m) => m.GlobalCanvas),
  { ssr: false },
);

export default function Home() {
  return (
    <>
      <GlobalCanvas />

      {/* Semantic HTML content for search engine crawlers & screen readers */}
      <section className="sr-only" aria-label="AlwaysDraw Product Summary">
        <h1>AlwaysDraw — The World&apos;s Shared Real-Time Canvas</h1>
        <h2>About AlwaysDraw — The World&apos;s Shared Canvas</h2>
        <p>
          AlwaysDraw is a single, permanent, public drawing canvas shared by everyone on the internet simultaneously in real time.
          No accounts, no rooms, no protected areas, and no undo. Anyone can draw, erase, or spray paint over anyone else&apos;s work.
        </p>

        <h3>13 Unique Brush Textures &amp; Tools</h3>
        <ul>
          <li><strong>Basic Tools:</strong> Brush, Pencil, Marker, Highlighter, Calligraphy, Pixel Art, Eraser</li>
          <li><strong>Artistic Brushes:</strong> Watercolor, Oil Paint, Chalk, Charcoal</li>
          <li><strong>Effect Brushes:</strong> Neon Glow, Glitter</li>
          <li><strong>Utility Tools:</strong> Pan, Magnifier Loupe, Ruler, Shapes (Line, Square, Circle, Triangle)</li>
        </ul>

        <h3>Real-Time Multiplayer Features</h3>
        <ul>
          <li>Live real-time stroke synchronization across desktop and mobile browsers</li>
          <li>Interactive Mini-map and activity heatmap overlay</li>
          <li>Historical Time-Travel replay to watch artwork evolve stroke-by-stroke</li>
          <li>Spatial Hotspot Discovery and direct coordinate deep linking</li>
        </ul>
      </section>
    </>
  );
}
