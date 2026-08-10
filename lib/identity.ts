const STORAGE_KEY = "alwaysdraw:clientId";

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
