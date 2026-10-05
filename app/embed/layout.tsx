import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site";

// /embed is the canvas framed inside other sites. Keep it out of the index
// and point search engines at the real page instead.
export const metadata: Metadata = {
  title: "Embedded Canvas",
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl("/canvas") },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
