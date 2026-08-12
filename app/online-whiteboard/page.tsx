import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/SeoLandingPage";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://alwaysdraw.com";
const CANONICAL_URL = `${SITE_URL}/online-whiteboard`;

export const metadata: Metadata = {
  title: "Free Online Whiteboard & Real-Time Collaborative Canvas",
  description:
    "Free online whiteboard for real-time visual collaboration, diagramming, sketching, and brainstorming. Infinite workspace with zero sign-up required.",
  keywords: [
    "online whiteboard",
    "free online whiteboard",
    "collaborative whiteboard",
    "digital whiteboard free",
    "virtual whiteboard",
    "online sketching board",
    "brainstorming canvas",
    "infinite online whiteboard",
  ],
  alternates: {
    canonical: CANONICAL_URL,
  },
  openGraph: {
    title: "Free Online Whiteboard & Real-Time Collaborative Canvas",
    description:
      "Free online whiteboard for real-time visual collaboration, diagramming, sketching, and brainstorming. Infinite workspace with zero sign-up.",
    url: CANONICAL_URL,
    type: "website",
  },
};

const FEATURES = [
  {
    icon: "📐",
    title: "Precision Diagramming Tools",
    description: "Built-in rulers, geometric shapes (lines, arrows, rectangles, circles, stars), and coordinate finder for structured diagrams.",
  },
  {
    icon: "💬",
    title: "Sticky Notes & Sticky Comments",
    description: "Drop persistent text comments and sticky notes anywhere on the whiteboard to capture feedback and brainstormed ideas.",
  },
  {
    icon: "🔍",
    title: "Infinite Pan & Zoom Workspace",
    description: "Never run out of whiteboard space. Pan smoothly and zoom from macro diagrams to micro details.",
  },
  {
    icon: "✏️",
    title: "13 Versatile Markers & Pens",
    description: "Switch seamlessly between fine-point pencils, chisel markers, highlighters, calligraphy nibs, and chalk.",
  },
  {
    icon: "🌐",
    title: "Cross-Platform Universal Access",
    description: "Works on desktop web browsers, tablets, and smartphones with instant touch and stylus input support.",
  },
  {
    icon: "⚡",
    title: "No Sign-Up Friction",
    description: "Start collaborating instantly without entering email addresses, passwords, or credit cards.",
  },
];

const FAQS = [
  {
    question: "What makes AlwaysDraw a great free online whiteboard?",
    answer: "AlwaysDraw provides a zero-friction online whiteboard that requires no accounts, no trial periods, and no downloads. You get instant access to an infinite canvas with real-time multiplayer editing, shape tools, and sticky notes.",
  },
  {
    question: "Can I use AlwaysDraw for remote team brainstorming?",
    answer: "Absolutely! Teams can sketch architecture diagrams, leave sticky note comments, draw flowcharts with arrow tools, and share deep links to exact canvas coordinates.",
  },
  {
    question: "Is there a limit on how large the whiteboard can be?",
    answer: "No. AlwaysDraw features an infinite workspace where you can continuously pan, zoom, and expand your diagrams.",
  },
  {
    question: "Does AlwaysDraw support iPad and Apple Pencil?",
    answer: "Yes! AlwaysDraw is optimized for touch and digital styluses including iPad Apple Pencil and Android tablets.",
  },
];

export default function OnlineWhiteboardPage() {
  return (
    <SeoLandingPage
      title="Free Online Whiteboard for Real-Time Collaboration"
      subtitle="Brainstorm ideas, sketch diagrams, leave sticky notes, and collaborate visually with zero sign-up friction."
      badgeText="Collaborative Digital Whiteboard"
      description="Free online whiteboard for real-time visual collaboration, diagramming, sketching, and brainstorming. Infinite workspace with zero sign-up."
      features={FEATURES}
      faqs={FAQS}
      canonicalUrl={CANONICAL_URL}
    />
  );
}
