"use client";

import dynamic from "next/dynamic";

const GlobalCanvas = dynamic(
  () => import("@/components/GlobalCanvas").then((m) => m.GlobalCanvas),
  { ssr: false },
);

export default function BoardPage() {
  return <GlobalCanvas mode="board" />;
}
