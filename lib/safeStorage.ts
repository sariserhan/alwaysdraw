// localStorage access wrapped for environments where it can throw
// synchronously — Safari/WebKit's SecurityError inside a sandboxed iframe
// without allow-same-origin (app/embed's whole purpose is being iframed on
// third-party sites), or any browser's strict third-party-storage/privacy
// blocking. Every direct localStorage call in this app used to skip this
// entirely, and several ran inside useState lazy initializers — a throw
// there happens during React's render phase, which without an error
// boundary can unmount the whole tree, bypassing even a window-level error
// handler. Route every read/write through here instead.

export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best-effort: storage is blocked, continue without persistence for
    // this session rather than crash.
  }
}

export function safeLocalStorageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // See safeLocalStorageSet.
  }
}

// sessionStorage is a separate Web Storage API object, but subject to the
// exact same access restrictions (and throws the same SecurityError) as
// localStorage — see the module doc comment above.

export function safeSessionStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionStorageSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Best-effort: storage is blocked, continue without persistence for
    // this session rather than crash.
  }
}

export function safeSessionStorageRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // See safeSessionStorageSet.
  }
}
