import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";
const CANONICAL_URL = `${SITE_URL}/draw-with-friends`;

export const metadata: Metadata = {
  title: "Draw With Friends Online — Free Real-Time Multiplayer Canvas",
  description:
    "Draw with friends online instantly with zero sign-up! Play, doodle, and sketch together in real time on an infinite multiplayer canvas with 13 unique brush textures.",
  keywords: [
    "draw with friends",
    "draw with friends online",
    "multiplayer drawing online",
    "draw together online",
    "collaborative drawing game",
    "online doodle board",
    "free drawing room",
    "shared canvas with friends",
  ],
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: "Draw With Friends Online — Free Real-Time Multiplayer Canvas",
    description:
      "Draw with friends online instantly with zero sign-up! Play, doodle, and sketch together in real time on an infinite multiplayer canvas.",
    url: CANONICAL_URL,
    type: "website",
  },
};

const FEATURES = [
  {
    icon: "👥",
    title: "Instant Multiplayer Sharing",
    description: "Share a direct canvas link or coordinate hotspot with your friends to draw together instantly without registering accounts.",
  },
  {
    icon: "🎨",
    title: "13 Realistic Brush Textures",
    description: "From watercolor and oil paint to neon glow, chalk, and pixel art brushes, explore rich artistic tools together.",
  },
  {
    icon: "⚡",
    title: "Zero-Lag Synchronization",
    description: "Every stroke is synchronized instantly across all connected mobile and desktop browsers powered by WebSockets.",
  },
  {
    icon: "🗺️",
    title: "Live Minimap & Heatmap",
    description: "Track where your friends are drawing on the infinite wall using spatial indicators and activity heatmaps.",
  },
  {
    icon: "⏱️",
    title: "Time-Travel Replay",
    description: "Watch how your collaborative artwork was built stroke-by-stroke with interactive historical playback.",
  },
  {
    icon: "🔒",
    title: "100% Free & Anonymous",
    description: "No logins, no paywalls, and no hidden subscriptions. Jump straight into creative collaboration with your group.",
  },
];

const FAQS = [
  {
    question: "How do I draw with friends online on AlwaysDraw?",
    answer: "Simply click 'Launch Live Canvas Now' and copy your browser URL or use the Share button to send the direct canvas link to your friends. Everyone who opens the link joins the same live canvas instantly.",
  },
  {
    question: "Is there any account sign-up or registration needed?",
    answer: "No. AlwaysDraw requires zero sign-up, zero accounts, and zero email addresses. You and your friends can start drawing within seconds.",
  },
  {
    question: "Does it work on mobile phones and tablets?",
    answer: "Yes! AlwaysDraw supports multi-touch gestures on iOS, iPadOS, Android, and all desktop operating systems.",
  },
  {
    question: "Can multiple people draw in the exact same spot at the same time?",
    answer: "Yes. AlwaysDraw supports unlimited simultaneous users drawing at the exact same location in real time with instant stroke layering.",
  },
];

export default function DrawWithFriendsPage() {
  return (
    <SeoLandingPage
      title="Draw With Friends Online in Real Time"
      subtitle="The ultimate free multiplayer canvas to sketch, doodle, paint, and collaborate live with your friends — no accounts or installs required."
      badgeText="Free Multiplayer Canvas"
      description="Draw with friends online instantly with zero sign-up! Play, doodle, and sketch together in real time on an infinite multiplayer canvas."
      features={FEATURES}
      faqs={FAQS}
      canonicalUrl={CANONICAL_URL}
    />
  );
}
