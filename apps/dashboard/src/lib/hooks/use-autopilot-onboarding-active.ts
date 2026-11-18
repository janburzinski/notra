"use client";

import { useSyncExternalStore } from "react";

let active = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** While Ollie's setup chat is on screen, it stands in for the agent dock. */
export function setAutopilotOnboardingActive(next: boolean) {
  if (active === next) {
    return;
  }
  active = next;
  for (const listener of listeners) {
    listener();
  }
}

export function useAutopilotOnboardingActive() {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false
  );
}
