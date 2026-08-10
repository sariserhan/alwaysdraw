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
  return <GlobalCanvas />;
}
