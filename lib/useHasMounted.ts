import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only after client mount — for gating `createPortal(..., document.body)`
 * calls, which can't run during SSR since `document` doesn't exist there.
 * useSyncExternalStore (not a `useState` + `useEffect(() => setMounted(true))`
 * pair) so this never calls setState from inside an effect. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
