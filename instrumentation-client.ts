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
    ignoreErrors: [
      // React Server Components' Flight client throws this when the
      // streamed page payload is cut off mid-transfer — tab closed,
      // navigated away, or network dropped while a page was still
      // streaming in. Every report of it has an all-internal stack (no
      // app frames), so it isn't actionable app-code noise.
      "Connection closed",
      // window.android is a native-app JS bridge object — confirmed absent
      // from this codebase and every bundled dependency. Only some Android
      // WebView wrapper embedding this site can inject it, and a missing
      // bridge method there is a bug in that wrapper, never ours. Filtered
      // by message, not denyUrls: the bridge is injected directly, not
      // loaded from a script URL, so there's nothing to match on that axis.
      /window\.android\./,
    ],
    // lib/globalErrorFiltering.ts's isIgnorableGlobalError already stops
    // this from showing the reload prompt to users, but that's a separate,
    // app-level mechanism — Sentry's own GlobalHandlers integration
    // captures uncaught errors independently of it, so without a matching
    // Sentry-level filter this kept reaching the dashboard as noise even
    // after the user-facing crash was fixed. denyUrls filters by the
    // erroring script's origin, same signal as that app-level fix.
    denyUrls: [
      /visitorping\.com/, // scroll-depth/analytics beacon, loaded site-wide
      /\/vp\.js/, // its actual served filename, seen in some stack traces instead of the full URL
    ],
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
