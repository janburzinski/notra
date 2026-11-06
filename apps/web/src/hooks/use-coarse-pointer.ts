import { useSyncExternalStore } from "react";

const COARSE_POINTER_QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(COARSE_POINTER_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True on touch-first devices (phones, tablets); false on the server. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COARSE_POINTER_QUERY).matches,
    () => false
  );
}
