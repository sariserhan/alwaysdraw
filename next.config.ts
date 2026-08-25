import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Only /embed is meant to be iframed (see ShareModal.tsx's embed code) — the
// other real pages get clickjacking protection. next.config's headers()
// matcher is path-to-regexp, not a raw regex, so there's no clean way to
// express "everything except /embed" in one rule — list the actual pages
// instead, and add new top-level routes here as they're created.
const FRAME_PROTECTED_SOURCES = ["/", "/canvas", "/sketchbook", "/sketchbook/:pageId"];

const nextConfig: NextConfig = {
  async headers() {
    return FRAME_PROTECTED_SOURCES.map((source) => ({
      source,
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      ],
    }));
  },
};

const hasSourceMapUpload = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !hasSourceMapUpload,
  sourcemaps: { disable: !hasSourceMapUpload },
  widenClientFileUpload: hasSourceMapUpload,
});

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
