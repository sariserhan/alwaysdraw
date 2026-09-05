import { describe, it, expect } from "vitest";
import { isIgnorableGlobalError } from "./globalErrorFiltering";

describe("isIgnorableGlobalError", () => {
  it("ignores the RSC Flight client's benign navigation-interrupt error", () => {
    expect(isIgnorableGlobalError("Connection closed")).toBe(true);
    expect(isIgnorableGlobalError("Error: Connection closed.")).toBe(true);
  });

  it("ignores the famously harmless ResizeObserver loop warning", () => {
    expect(isIgnorableGlobalError("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isIgnorableGlobalError("ResizeObserver loop limit exceeded")).toBe(true);
  });

  it("does not ignore a genuine uncaught error", () => {
    expect(isIgnorableGlobalError("SyntaxError: JSON Parse error: Unterminated string")).toBe(false);
    expect(isIgnorableGlobalError("TypeError: Cannot read properties of undefined")).toBe(false);
  });

  it("does not ignore an empty message", () => {
    expect(isIgnorableGlobalError("")).toBe(false);
  });

  it("ignores any error whose source is VisitorPing's analytics script, regardless of message", () => {
    // Sentry's own stack-trace normalization has shown this script's source
    // as the short "app:///vp.js" form — must match that too, not just the
    // full CDN URL.
    expect(isIgnorableGlobalError("NS_ERROR_FAILURE: No error message", "app:///vp.js")).toBe(true);
    expect(
      isIgnorableGlobalError("TypeError: something", "https://cdn.visitorping.com/vp.js?site=vp_ABC123"),
    ).toBe(true);
  });

  it("does not ignore the same message when the source is our own code", () => {
    expect(isIgnorableGlobalError("TypeError: something", "app:///_next/static/chunks/main.js")).toBe(false);
  });

  it("does not ignore a genuine error when no source is provided", () => {
    expect(isIgnorableGlobalError("TypeError: something", undefined)).toBe(false);
  });

  it("ignores a missing-method error from an Android WebView wrapper's injected bridge", () => {
    expect(isIgnorableGlobalError("TypeError: window.android.unLoad is not a function")).toBe(true);
    // Any method on that bridge, not just unLoad — same third-party object.
    expect(isIgnorableGlobalError("TypeError: window.android.onResume is not a function")).toBe(true);
  });
});
