import { describe, it, expect, afterEach, vi } from "vitest";
import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeLocalStorageRemove,
  safeSessionStorageGet,
  safeSessionStorageSet,
  safeSessionStorageRemove,
} from "./safeStorage";

function stubWindow(
  key: "localStorage" | "sessionStorage",
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
) {
  vi.stubGlobal("window", { [key]: storage });
}

function throwSecurityError(): never {
  throw new DOMException("Access is denied for this document.", "SecurityError");
}

describe("safeStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe.each([
    {
      name: "localStorage",
      storageKey: "localStorage" as const,
      get: safeLocalStorageGet,
      set: safeLocalStorageSet,
      remove: safeLocalStorageRemove,
    },
    {
      name: "sessionStorage",
      storageKey: "sessionStorage" as const,
      get: safeSessionStorageGet,
      set: safeSessionStorageSet,
      remove: safeSessionStorageRemove,
    },
  ])("$name", ({ storageKey, get, set, remove }) => {
    it("returns null when there is no window (SSR)", () => {
      expect(get("k")).toBeNull();
    });

    it("no-ops set/remove when there is no window (SSR)", () => {
      expect(() => set("k", "v")).not.toThrow();
      expect(() => remove("k")).not.toThrow();
    });

    it("gets, sets, and removes values when storage works normally", () => {
      const store = new Map<string, string>();
      stubWindow(storageKey, {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => void store.set(key, value),
        removeItem: (key) => void store.delete(key),
      });

      expect(get("k")).toBeNull();
      set("k", "v");
      expect(get("k")).toBe("v");
      remove("k");
      expect(get("k")).toBeNull();
    });

    describe("when storage throws SecurityError (sandboxed iframe, strict privacy mode)", () => {
      it("get returns null instead of throwing", () => {
        stubWindow(storageKey, { getItem: throwSecurityError, setItem: vi.fn(), removeItem: vi.fn() });
        expect(() => get("k")).not.toThrow();
        expect(get("k")).toBeNull();
      });

      it("set silently no-ops instead of throwing", () => {
        stubWindow(storageKey, { getItem: vi.fn(), setItem: throwSecurityError, removeItem: vi.fn() });
        expect(() => set("k", "v")).not.toThrow();
      });

      it("remove silently no-ops instead of throwing", () => {
        stubWindow(storageKey, { getItem: vi.fn(), setItem: vi.fn(), removeItem: throwSecurityError });
        expect(() => remove("k")).not.toThrow();
      });
    });
  });
});
