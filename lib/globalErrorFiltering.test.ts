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
});
