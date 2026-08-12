import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { ChromeRivet } from "@/components/ChromeRivet";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";

export const metadata: Metadata = {
  title: "AlwaysDraw — The World's Shared Real-Time Canvas",
  description:
    "One world. One canvas. Always drawing. Join a single public drawing wall shared by everyone on the internet in real time. Draw, erase, spray paint, and doodle anonymously with 13 unique brush textures.",
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
    "infinite canvas online",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "AlwaysDraw — The World's Shared Real-Time Canvas",
    description:
      "One world. One canvas. Always drawing. Join a single public drawing wall shared by everyone on the internet in real time.",
    url: SITE_URL,
    type: "website",
  },
};

const FEATURES = [
  {
    icon: "🖌️",
    title: "13 Unique Brush Textures",
    description:
      "Switch between Watercolor, Oil Paint, Neon Glow, Chalk, Charcoal, Calligraphy, Pixel Art, Pencil, Marker, and Glitter effect nibs.",
  },
  {
    icon: "⚡",
    title: "Real-Time WebSockets Sync",
    description:
      "Every stroke is synchronized across connected desktop, tablet, and mobile devices instantly without lag.",
  },
  {
    icon: "🌌",
    title: "Infinite Pan & Zoom Workspace",
    description:
      "Boundless drawing surface. Zoom in to draw micro details or pan out to view large-scale collaborative murals.",
  },
  {
    icon: "⏱️",
    title: "Historical Time-Travel Replay",
    description:
      "Rewind time and watch artwork evolve stroke-by-stroke with interactive historical playback.",
  },
  {
    icon: "📐",
    title: "Precision Rulers & Shapes",
    description: "Draw perfect lines, arrows, rectangles, circles, triangles, stars, and measure lengths with precision tools.",
  },
  {
    icon: "💬",
    title: "Vector Text & Sticky Comments",
    description: "Drop persistent vector text, annotations, and sticky notes anywhere on the shared canvas.",
  },
];

const FAQS = [
  {
    question: "What is AlwaysDraw?",
    answer: "AlwaysDraw is a single, permanent public drawing canvas shared live by everyone on the internet simultaneously in real time. Anyone can draw, erase, or spray paint over anyone else's work without registration.",
  },
  {
    question: "Do I need an account to draw?",
    answer: "No! AlwaysDraw requires zero sign-up, zero accounts, and zero email addresses. You can jump directly into the live canvas and start drawing in seconds.",
  },
  {
    question: "How do I invite my friends to draw with me?",
    answer: "Click 'Launch Live Canvas', copy your browser URL or click the Share button, and send the link to your friends. Everyone who opens the link joins the same live canvas instantly.",
  },
  {
    question: "Does AlwaysDraw work on tablets and mobile phones?",
    answer: "Yes! AlwaysDraw supports multi-touch gestures and digital styluses (including iPad Apple Pencil and Android styluses) on all mobile devices.",
  },
];

export default function Home() {
  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-chrome-bg text-ink font-sans selection:bg-accent-crimson selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />

      {/* NAVIGATION BAR */}
      <header className="sticky top-0 z-50 border-b border-chrome-border bg-chrome-bg-raised/95 backdrop-blur-md px-4 sm:px-8 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-decoration-none group">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent-crimson text-white font-mono font-bold text-base shadow-md group-hover:scale-105 transition-transform">
              AD
            </div>
            <span className="font-mono text-lg font-bold tracking-tight text-ink">
              AlwaysDraw<span className="text-accent-crimson">.com</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-mono font-bold uppercase tracking-wider text-ink-dim">
            <Link href="/canvas" className="text-accent-yellow hover:text-ink transition">
              🎨 Live Canvas
            </Link>
            <Link href="/draw-with-friends" className="hover:text-ink transition">
              👥 Draw With Friends
            </Link>
            <Link href="/online-whiteboard" className="hover:text-ink transition">
              📐 Whiteboard
            </Link>
            <Link href="/infinite-canvas" className="hover:text-ink transition">
              🌌 Infinite Canvas
            </Link>
          </nav>

          <Link
            href="/canvas"
            className="flex items-center gap-2 rounded-sm bg-accent-crimson px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent-crimson-deep hover:scale-[1.02] transition-all"
          >
            <span>Enter Canvas</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden px-4 sm:px-8 pt-16 pb-24 border-b border-chrome-border bg-[radial-gradient(ellipse_at_top,rgba(217,70,38,0.15),transparent_70%)]">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rust/50 bg-chrome-bg-raised px-4 py-1.5 text-xs font-mono font-bold tracking-wide uppercase text-accent-yellow mb-8 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Shared World Canvas • 100% Free &amp; Zero Sign-Up</span>
          </div>

          <h1 className="font-display text-4xl sm:text-7xl font-bold tracking-tight text-ink leading-[1.1] mb-6">
            One World. One Canvas.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-yellow via-rust to-accent-crimson">
              Always Drawing.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-ink-dim max-w-2xl mx-auto leading-relaxed mb-10">
            Join thousands of creators on a single, permanent public canvas live 24/7. Sketch, doodle, spray paint, and collaborate in real time with 13 realistic brush textures.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/canvas"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-md bg-accent-crimson px-10 py-4.5 text-lg font-mono font-bold uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(217,70,38,0.4)] hover:bg-accent-crimson-deep hover:scale-[1.03] transition-all"
            >
              <span>Start Drawing Now</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <Link
              href="/draw-with-friends"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-chrome-border bg-chrome-bg-raised px-6 py-4.5 text-base font-mono font-bold uppercase tracking-wider text-ink hover:bg-chrome-border transition"
            >
              <span>Draw With Friends</span>
            </Link>
          </div>

          {/* STATS STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto border border-chrome-border bg-chrome-bg-raised/80 rounded-lg p-4 font-mono text-xs shadow-md">
            <div>
              <div className="text-accent-yellow font-bold text-base">100% Free</div>
              <div className="text-ink-dim text-[11px] uppercase">No Paywalls</div>
            </div>
            <div>
              <div className="text-accent-yellow font-bold text-base">13 Brushes</div>
              <div className="text-ink-dim text-[11px] uppercase">Artistic Textures</div>
            </div>
            <div>
              <div className="text-accent-yellow font-bold text-base">Infinite Zoom</div>
              <div className="text-ink-dim text-[11px] uppercase">Endless Workspace</div>
            </div>
            <div>
              <div className="text-accent-yellow font-bold text-base">Zero Logins</div>
              <div className="text-ink-dim text-[11px] uppercase">Instant Access</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE CARDS GRID */}
      <section className="px-4 sm:px-8 py-20 border-b border-chrome-border max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-accent-crimson mb-2 flex items-center justify-center gap-1.5">
            <ChromeRivet className="relative" />
            <span>Industrial Creative Engine</span>
          </h2>
          <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Engineered for Unlimited Creativity &amp; Speed
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat, i) => (
            <div
              key={i}
              className="rounded-lg border border-chrome-border bg-chrome-bg-raised p-6 shadow-md hover:border-rust/50 transition-colors"
            >
              <div className="text-3xl mb-4">{feat.icon}</div>
              <h4 className="font-display text-xl font-bold text-ink mb-2">
                {feat.title}
              </h4>
              <p className="text-sm text-ink-dim leading-relaxed">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* USE CASE SECTIONS */}
      <section className="px-4 sm:px-8 py-20 border-b border-chrome-border max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-accent-crimson mb-2">
            Tailored Experiences
          </h2>
          <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Ways to Use AlwaysDraw
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col justify-between rounded-lg border border-chrome-border bg-chrome-bg-raised p-6 shadow-md">
            <div>
              <div className="text-4xl mb-4">👥</div>
              <h4 className="font-display text-2xl font-bold text-ink mb-3">Draw With Friends</h4>
              <p className="text-sm text-ink-dim leading-relaxed mb-6">
                Host instant multiplayer doodle sessions, play drawing games, and sketch together live with zero setup.
              </p>
            </div>
            <Link
              href="/draw-with-friends"
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-rust/40 bg-rust/10 px-4 py-2 font-mono text-xs font-bold uppercase text-accent-yellow hover:bg-rust hover:text-white transition"
            >
              <span>Explore Draw With Friends</span>
              <span>➔</span>
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-chrome-border bg-chrome-bg-raised p-6 shadow-md">
            <div>
              <div className="text-4xl mb-4">📐</div>
              <h4 className="font-display text-2xl font-bold text-ink mb-3">Online Whiteboard</h4>
              <p className="text-sm text-ink-dim leading-relaxed mb-6">
                Brainstorm diagrams, place sticky note comments, draw flowcharts, and map out concepts with precision tools.
              </p>
            </div>
            <Link
              href="/online-whiteboard"
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-rust/40 bg-rust/10 px-4 py-2 font-mono text-xs font-bold uppercase text-accent-yellow hover:bg-rust hover:text-white transition"
            >
              <span>Explore Online Whiteboard</span>
              <span>➔</span>
            </Link>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-chrome-border bg-chrome-bg-raised p-6 shadow-md">
            <div>
              <div className="text-4xl mb-4">🌌</div>
              <h4 className="font-display text-2xl font-bold text-ink mb-3">Infinite Canvas</h4>
              <p className="text-sm text-ink-dim leading-relaxed mb-6">
                Paint micro-art inside macro murals on an endless, boundless canvas shared by creators worldwide.
              </p>
            </div>
            <Link
              href="/infinite-canvas"
              className="inline-flex items-center justify-center gap-2 rounded-sm border border-rust/40 bg-rust/10 px-4 py-2 font-mono text-xs font-bold uppercase text-accent-yellow hover:bg-rust hover:text-white transition"
            >
              <span>Explore Infinite Canvas</span>
              <span>➔</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section className="px-4 sm:px-8 py-20 border-b border-chrome-border max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-accent-crimson mb-2">
            Questions &amp; Answers
          </h2>
          <h3 className="font-display text-3xl font-bold text-ink">
            Frequently Asked Questions
          </h3>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, index) => (
            <div key={index} className="rounded-md border border-chrome-border bg-chrome-bg-raised p-6">
              <h4 className="font-display text-lg font-bold text-ink mb-2">
                {faq.question}
              </h4>
              <p className="text-sm text-ink-dim leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="px-4 sm:px-8 py-20 text-center bg-chrome-bg-raised">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink mb-6">
            Join The Global Canvas
          </h2>
          <p className="text-lg text-ink-dim mb-8">
            Click below to jump straight into the live multiplayer drawing wall.
          </p>
          <Link
            href="/canvas"
            className="inline-flex items-center gap-3 rounded-md bg-accent-crimson px-10 py-5 text-lg font-mono font-bold uppercase tracking-wider text-white shadow-[0_12px_32px_rgba(217,70,38,0.4)] hover:bg-accent-crimson-deep hover:scale-[1.03] transition-all"
          >
            <span>Launch Live Canvas (/canvas)</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* SITE FOOTER */}
      <Footer />
    </div>
  );
}
