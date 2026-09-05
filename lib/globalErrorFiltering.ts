// Known-benign browser/framework noise that reaches window.onerror /
// unhandledrejection without being an actual app failure — mirrors Sentry's
// own ignoreErrors list in instrumentation-client.ts (kept as a separate,
// smaller list here on purpose: this gate decides whether to interrupt the
// user with a reload prompt, a much higher bar than whether to report the
// error at all).
const IGNORED_PATTERNS = [
  /Connection closed/, // RSC Flight client: streamed page cut off by navigation/tab-close
  /ResizeObserver loop/, // famously harmless browser warning, several ResizeObservers in this app
  // window.android is a native-app JS bridge object — confirmed absent
  // from this codebase and every bundled dependency (grepped the full
  // built output, zero matches), so it can only be injected directly by
  // some Android WebView wrapper app embedding this site, not by anything
  // we load. A page lifecycle event (e.g. pagehide) triggers the
  // wrapper's own injected listener, which then calls a bridge method
  // ("unLoad" seen so far) missing on that device's WebView version —
  // a bug in that wrapper's bridge, never something our own code can be
  // broken by, so it's filtered by message rather than source (there's
  // no script URL to match: it's injected directly, not loaded from one).
  /window\.android\./,
];

// Third-party script origins whose own uncaught errors must never interrupt
// the user — filtered by source, not message text, since an analytics
// script's failure mode is opaque to us (message could be anything, e.g. a
// generic NS_ERROR_FAILURE from a blocked/failed network call) but the fact
// that it's THIS untrusted origin, not our own code, is the reliable signal:
// nothing this script does can affect whether the app actually works.
const IGNORED_SOURCE_PATTERNS = [
  // scroll-depth/analytics beacon script — loaded site-wide, only ever
  // active on pages with real page scroll (the homepage; /canvas and
  // /board never scroll). Matches both the real CDN URL and the short
  // "vp.js" filename Sentry's own stack-trace normalization has shown it
  // as (e.g. "app:///vp.js") — either form reliably identifies this one
  // third-party script and nothing of ours.
  /visitorping\.com/,
  /\/vp\.js\b/,
];

export function isIgnorableGlobalError(message: string, source?: string): boolean {
  if (IGNORED_PATTERNS.some((pattern) => pattern.test(message))) return true;
  if (source && IGNORED_SOURCE_PATTERNS.some((pattern) => pattern.test(source))) return true;
  return false;
}
