import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "AlwaysDraw",
  description: "One world. One canvas. Always drawing.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable} h-full overscroll-none antialiased`}
    >
      <body className="h-full overflow-hidden overscroll-none">
        {/*
THESIS: One rusted train-yard wall the whole internet keeps tagging, not a
whiteboard app with a floating toolbar politely hovering over a blank page.
OWN-WORLD: Near-black weathered steel chrome, warm concrete-gray canvas
ground, spray-can accent set (crimson, acid green, electric blue, warning
yellow), Space Grotesk UI text, Space Mono for counts and measurements,
stencil-numeral labels, spray-drip edges, rivet-bolted toolbar.
STORY: A visitor understands instantly this wall already belongs to
strangers, their mark will get buried too, and there's nothing to set up —
they draw immediately.
FIRST VIEWPORT: Full-bleed cracked-concrete canvas edge to edge; a thin
riveted steel strip on top carries a stenciled wordmark left and a rust-red
online-count plate right; a bolted spray-can rack toolbar floats
bottom-center; no other chrome.
FORM: Yard Wall (subway/train-yard graffiti), MY PICK, position 1 of the
model's own list; seed key b1edd97d.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md
        */}
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
