import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { WebVitals } from "@/components/WebVitals";
import "./globals.css";

const spaceGrotesk = localFont({
  src: [
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2", weight: "500" },
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2", weight: "600" },
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/space-mono/files/space-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-mono",
  display: "swap",
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
      suppressHydrationWarning
    >
      <head>
        {/* Dark is the committed default; set before paint so a returning
            visitor's saved "light" choice never flashes dark first. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('alwaysdraw:theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
      </head>
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
FIRST VIEWPORT: Full-bleed plain concrete canvas edge to edge; a thin
riveted steel strip on top carries a stenciled wordmark left and a rust-red
online-count plate right; a bolted spray-can rack toolbar floats
bottom-center; no other chrome.
FORM: Yard Wall (subway/train-yard graffiti), MY PICK, position 1 of the
model's own list; seed key b1edd97d.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md
        */}
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <WebVitals />
      </body>
    </html>
  );
}
