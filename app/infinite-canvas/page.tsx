import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";
const CANONICAL_URL = `${SITE_URL}/infinite-canvas`;

export const metadata: Metadata = {
  title: "The Infinite Canvas — Real-Time Shared Online Drawing Wall",
  description:
    "Explore an endless, infinite digital drawing wall shared live by artists worldwide. Sketch, spray paint, and doodle endlessly on one global canvas.",
  keywords: [
    "infinite canvas",
    "infinite canvas online",
    "endless drawing board",
    "shared internet canvas",
    "global drawing wall",
    "infinite zoom drawing",
    "online art wall",
    "real time infinite canvas",
  ],
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: "The Infinite Canvas — Real-Time Shared Online Drawing Wall",
    description:
      "Explore an endless, infinite digital drawing wall shared live by artists worldwide. Sketch, spray paint, and doodle endlessly on one global canvas.",
    url: CANONICAL_URL,
    type: "website",
  },
};

const FEATURES = [
  {
    icon: "🌌",
    title: "Boundless Infinite Workspace",
    description: "Pan infinitely across a vast digital landscape. Create micro-art hidden inside macro illustrations.",
  },
  {
    icon: "🖌️",
    title: "Artistic & Spray Paint Brushes",
    description: "Experience spray paint stencils, oil paint blendings, watercolor washes, and pixel art brushes.",
  },
  {
    icon: "🗺️",
    title: "Interactive Activity Heatmap",
    description: "Use the live activity overlay to discover active drawing hotspots and creative hubs across the infinite wall.",
  },
  {
    icon: "📍",
    title: "Spatial Coordinate Deep Links",
    description: "Every location on the infinite canvas has unique coordinates. Bookmark and share exact locations with direct links.",
  },
  {
    icon: "🎥",
    title: "Historical Time-Travel Playback",
    description: "Watch artwork come to life over time with stroke-by-stroke time travel history.",
  },
  {
    icon: "🌍",
    title: "Global Real-Time Community",
    description: "Join thousands of creative users across the globe contributing to a single living, breathing art installation.",
  },
];

const FAQS = [
  {
    question: "What is an Infinite Canvas?",
    answer: "An infinite canvas is a digital drawing surface with unlimited boundaries. Unlike traditional fixed-size canvases, you can pan continuously in any direction and zoom infinitely to draw fine details.",
  },
  {
    question: "Is the AlwaysDraw canvas permanent?",
    answer: "Yes! AlwaysDraw operates a continuous, 24/7 global canvas where drawing activity persists over time.",
  },
  {
    question: "How do I share a specific artwork location on the infinite canvas?",
    answer: "Use the built-in Spatial Compass or Share button to generate a coordinate link. Anyone opening the link will land at the exact X, Y coordinates and zoom level of your artwork.",
  },
  {
    question: "Can I save or export my drawing from the infinite canvas?",
    answer: "Yes! You can export high-resolution PNG snapshots of any region on the canvas at any time.",
  },
];

export default function InfiniteCanvasPage() {
  return (
    <SeoLandingPage
      title="The World's Shared Infinite Drawing Canvas"
      subtitle="Step onto an endless digital canvas shared live by creators worldwide. Draw, doodle, spray paint, and explore without boundaries."
      badgeText="Endless Digital Workspace"
      description="Explore an endless, infinite digital drawing wall shared live by artists worldwide. Sketch, spray paint, and doodle endlessly on one global canvas."
      features={FEATURES}
      faqs={FAQS}
      canonicalUrl={CANONICAL_URL}
    />
  );
}
