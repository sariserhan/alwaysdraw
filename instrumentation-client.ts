import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
  });
}

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    persistence: "memory",
    person_profiles: "never",
    respect_dnt: true,
  });
  posthog.capture("wall_pageview", {
    path: window.location.pathname,
    release: process.env.NEXT_PUBLIC_APP_RELEASE,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
