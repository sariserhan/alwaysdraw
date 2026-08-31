// Known-benign browser/framework noise that reaches window.onerror /
// unhandledrejection without being an actual app failure — mirrors Sentry's
// own ignoreErrors list in instrumentation-client.ts (kept as a separate,
// smaller list here on purpose: this gate decides whether to interrupt the
// user with a reload prompt, a much higher bar than whether to report the
// error at all).
const IGNORED_PATTERNS = [
  /Connection closed/, // RSC Flight client: streamed page cut off by navigation/tab-close
  /ResizeObserver loop/, // famously harmless browser warning, several ResizeObservers in this app
];

export function isIgnorableGlobalError(message: string): boolean {
  return IGNORED_PATTERNS.some((pattern) => pattern.test(message));
}
