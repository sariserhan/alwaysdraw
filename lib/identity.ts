const STORAGE_KEY = "alwaysdraw:clientId";
const USERNAME_KEY = "alwaysdraw:username";
const COUNTRY_CODE_KEY = "alwaysdraw:countryCode";

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function getClientId(): string {
  if (typeof window === "undefined") return "anon-server";
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = `anon-${randomSuffix()}`;
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}

/** The display name a user chose for themselves, or undefined if unset — no
 * login, so this is purely a self-reported label attached to their strokes. */
export function getUsername(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(USERNAME_KEY)?.trim() || undefined;
}

/** Pass an empty/whitespace-only name to clear it back to anonymous. */
export function setUsername(name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (trimmed) {
    window.localStorage.setItem(USERNAME_KEY, trimmed);
  } else {
    window.localStorage.removeItem(USERNAME_KEY);
  }
}

/** Cached result of the one-time /api/geo lookup — see GlobalCanvas's
 * resolution effect. Avoids re-resolving on every reload. */
export function getCachedCountryCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(COUNTRY_CODE_KEY) || undefined;
}

export function setCachedCountryCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COUNTRY_CODE_KEY, code);
}
