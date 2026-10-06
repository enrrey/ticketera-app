import { useSyncExternalStore } from "react";

const loadedAt = Date.now();
const subscribe = () => () => {};

/** Browser time at page load; null while rendering on the server, so hydration never mismatches. Informational only. */
export function useClientNow() {
  return useSyncExternalStore(subscribe, () => loadedAt, () => null);
}
