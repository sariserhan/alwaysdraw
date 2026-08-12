"use client";

import Link from "next/link";
import { useState } from "react";
import { Footer } from "./Footer";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FeatureCard {
  title: string;
  description: string;
  icon: string;
}

export interface SeoLandingPageProps {
  title: string;
  subtitle: string;
  badgeText: string;
  description: string;
  features: FeatureCard[];
  faqs: FaqItem[];
  canonicalUrl: string;
}

export function SeoLandingPage({
  title,
  subtitle,
  badgeText,
  description,
  features,
  faqs,
  canonicalUrl,
}: SeoLandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const jsonLdFaq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const jsonLdApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AlwaysDraw",
    url: canonicalUrl,
    description: description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "All Web Browsers (Desktop & Mobile)",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <div className="min-h-screen bg-chrome-bg text-ink font-sans selection:bg-accent-crimson selection:text-white">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }}
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
            <Link href="/draw-with-friends" className="hover:text-ink transition">
              Draw With Friends
            </Link>
            <Link href="/online-whiteboard" className="hover:text-ink transition">
              Online Whiteboard
            </Link>
            <Link href="/infinite-canvas" className="hover:text-ink transition">
              Infinite Canvas
            </Link>
          </nav>

          <Link
            href="/canvas"
            className="flex items-center gap-2 rounded-sm bg-accent-crimson px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent-crimson-deep transition"
          >
            <span>Start Drawing</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden px-4 sm:px-8 pt-16 pb-20 border-b border-chrome-border bg-[radial-gradient(ellipse_at_top,rgba(217,70,38,0.12),transparent_70%)]">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rust/40 bg-chrome-bg-raised px-3.5 py-1 text-xs font-mono font-bold tracking-wide uppercase text-accent-yellow mb-6 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-accent-crimson animate-pulse" />
            <span>{badgeText}</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-ink leading-tight mb-6">
            {title}
          </h1>

          <p className="text-lg sm:text-xl text-ink-dim max-w-2xl mx-auto leading-relaxed mb-10">
            {subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/canvas"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-md bg-accent-crimson px-8 py-4 text-base font-mono font-bold uppercase tracking-wider text-white shadow-[0_10px_25px_rgba(217,70,38,0.35)] hover:bg-accent-crimson-deep hover:scale-[1.02] transition-all"
            >
              <span>Launch Live Canvas Now</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md border border-chrome-border bg-chrome-bg-raised px-6 py-4 text-base font-mono font-bold uppercase tracking-wider text-ink hover:bg-chrome-border transition"
            >
              <span>Explore Features</span>
            </a>
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 text-xs font-mono text-ink-dim">
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
              No Sign-Up Required
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
              100% Free Forever
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
              Instant Multi-User Sync
            </span>
          </div>
        </div>
      </section>

      {/* FEATURE HIGHLIGHTS GRID */}
      <section id="features" className="px-4 sm:px-8 py-20 border-b border-chrome-border max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-accent-crimson mb-2">
            Powerful Creative Capabilities
          </h2>
          <h3 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Everything You Need to Create &amp; Collaborate
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, i) => (
            <div
              key={i}
              className="rounded-lg border border-chrome-border bg-chrome-bg-raised p-6 shadow-md hover:border-rust/40 transition-colors"
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

      {/* SEO ARTICLE CONTENT SECTION */}
      <section className="px-4 sm:px-8 py-20 border-b border-chrome-border max-w-4xl mx-auto">
        <article className="prose prose-invert prose-stone max-w-none">
          <h2 className="font-display text-3xl font-bold text-ink mb-6">
            Why AlwaysDraw is the Ultimate Real-Time Canvas
          </h2>
          <p className="text-ink-dim leading-relaxed mb-6">
            Traditional online drawing applications require lengthy account registration, room creation steps, or paid subscriptions. <strong>AlwaysDraw</strong> removes every barrier by providing an open, infinite digital canvas that is live 24/7 for anyone on the internet.
          </p>
          <p className="text-ink-dim leading-relaxed mb-6">
            Whether you are sketching quick architectural diagrams, doodling pixel art with friends, practicing calligraphy, or brainstorming ideas on an online whiteboard, AlwaysDraw synchronizes every single brush stroke with zero lag.
          </p>

          <h3 className="font-display text-2xl font-bold text-ink mt-10 mb-4">
            13 Artistic Brush Textures &amp; Precision Tools
          </h3>
          <p className="text-ink-dim leading-relaxed mb-4">
            Express yourself with a rich suite of realistic drawing instruments designed for artistic freedom and precision layout:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-ink-dim mb-8 list-none pl-0">
            <li className="flex items-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2">
              <span className="text-accent-crimson font-bold">✓</span> Watercolor &amp; Oil Paint
            </li>
            <li className="flex items-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2">
              <span className="text-accent-crimson font-bold">✓</span> Chalk &amp; Charcoal Textures
            </li>
            <li className="flex items-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2">
              <span className="text-accent-crimson font-bold">✓</span> Neon Glow &amp; Glitter Effects
            </li>
            <li className="flex items-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2">
              <span className="text-accent-crimson font-bold">✓</span> Calligraphy &amp; Pixel Art Brush
            </li>
            <li className="flex items-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2">
              <span className="text-accent-crimson font-bold">✓</span> Precision Ruler &amp; Coordinate Finder
            </li>
            <li className="flex items-center gap-2 rounded-sm border border-chrome-border bg-chrome-bg-raised px-3 py-2">
              <span className="text-accent-crimson font-bold">✓</span> Geometric Shapes (Circles, Arrows, Stars)
            </li>
          </ul>
        </article>
      </section>

      {/* FAQ ACCORDION SECTION (Rich Search Results) */}
      <section className="px-4 sm:px-8 py-20 border-b border-chrome-border max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-accent-crimson mb-2">
            Got Questions?
          </h2>
          <h3 className="font-display text-3xl font-bold text-ink">
            Frequently Asked Questions
          </h3>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={index}
                className="rounded-md border border-chrome-border bg-chrome-bg-raised overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left font-display text-lg font-bold text-ink hover:text-accent-yellow transition-colors"
                >
                  <span>{faq.question}</span>
                  <span className="ml-4 font-mono text-xl font-bold text-accent-crimson">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-ink-dim leading-relaxed border-t border-chrome-border/50 pt-3">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CALL TO ACTION BANNER */}
      <section className="px-4 sm:px-8 py-20 text-center bg-chrome-bg-raised">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-ink mb-6">
            Ready to Start Drawing Together?
          </h2>
          <p className="text-lg text-ink-dim mb-8">
            Join thousands of artists and doodlers on the shared internet canvas right now.
          </p>
          <Link
            href="/canvas"
            className="inline-flex items-center gap-3 rounded-md bg-accent-crimson px-10 py-5 text-lg font-mono font-bold uppercase tracking-wider text-white shadow-[0_12px_30px_rgba(217,70,38,0.4)] hover:bg-accent-crimson-deep hover:scale-[1.03] transition-all"
          >
            <span>Jump Into The Live Canvas</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
