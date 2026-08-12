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
  // No bundled system-metric fallback: it would sit right after the real
  // font in --font-display and, for a glyph missing from the latin-only
  // file (e.g. Turkish ş/ğ/ı), the browser would grab that generic system
  // font before ever reaching --font-display-ext below. See spaceGroteskExt.
  adjustFontFallback: false,
});

const spaceMono = localFont({
  src: [
    { path: "../node_modules/@fontsource/space-mono/files/space-mono-latin-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-mono",
  display: "swap",
  adjustFontFallback: false,
});

// latin-only Space Grotesk/Mono lack Turkish (ş ğ ı İ), Vietnamese, and other
// Latin Extended-A characters, so those glyphs were silently falling back to
// a generic system font mid-word — same typeface everywhere except those
// specific letters. These latin-ext files (already in @fontsource, just not
// wired up) cover the gap; globals.css chains them in right after the base
// font so a missing glyph tries this before any generic fallback.
const spaceGroteskExt = localFont({
  src: [
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-ext-500-normal.woff2", weight: "500" },
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-ext-600-normal.woff2", weight: "600" },
    { path: "../node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-ext-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-display-ext",
  display: "swap",
});

const spaceMonoExt = localFont({
  src: [
    { path: "../node_modules/@fontsource/space-mono/files/space-mono-latin-ext-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/space-mono/files/space-mono-latin-ext-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-mono-ext",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.alwaysdraw.workers.dev";
const SITE_NAME = "AlwaysDraw";
const TITLE = "AlwaysDraw — The World's Shared Real-Time Canvas";
const DESCRIPTION =
  "One world. One canvas. Always drawing. Join a single public drawing wall shared by everyone on the internet in real time. Draw, erase, spray paint, and doodle anonymously with 13 unique brush textures.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | AlwaysDraw",
  },
  description: DESCRIPTION,
  keywords: [
    "AlwaysDraw",
    "shared canvas",
    "real time drawing",
    "collaborative drawing board",
    "multiplayer paint",
    "digital graffiti wall",
    "collaborative whiteboard",
    "online doodle wall",
    "anonymous drawing",
    "interactive web canvas",
    "pixel art wall",
  ],
  authors: [{ name: "AlwaysDraw Team" }],
  creator: "AlwaysDraw",
  publisher: "AlwaysDraw",
  applicationName: "AlwaysDraw",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/icon.svg" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "AlwaysDraw — The World's Shared Real-Time Drawing Canvas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.jpg"],
    creator: "@alwaysdraw",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Google Search Console's meta-tag verification method — set once you've
  // created a property for the site; see .env.example. Unset renders no tag.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#121315",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AlwaysDraw",
  alternateName: "Always Draw",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "All Web Browsers (Desktop & Mobile)",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Shared public drawing canvas",
    "Real-time multiplayer drawing synchronization",
    "13 unique brush textures (Watercolor, Oil Paint, Neon Glow, Chalk, Calligraphy, Pixel, Glitter)",
    "Anonymous instant access with no sign-up or accounts required",
    "Interactive Mini-map and Heatmap Activity Overlay",
    "Deep link sharing with viewport position",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable} ${spaceGroteskExt.variable} ${spaceMonoExt.variable} min-h-full antialiased`}
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full bg-chrome-bg text-ink font-sans antialiased">
        {/* Visually hidden semantic text for crawlers and screen readers */}
        <noscript>
          <div style={{ padding: "20px", color: "#ffffff", backgroundColor: "#121315" }}>
            <h1>AlwaysDraw — The World&apos;s Shared Real-Time Canvas</h1>
            <p>
              One world. One canvas. Always drawing. AlwaysDraw is a single public drawing canvas shared by everyone on the internet in real time. Draw, erase, spray-paint, or doodle anonymously with 13 unique brush textures without any accounts or login.
            </p>
          </div>
        </noscript>
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <WebVitals />
      </body>
    </html>
  );
}
