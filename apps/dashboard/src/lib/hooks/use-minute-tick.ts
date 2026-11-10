"use client";

import { useSyncExternalStore } from "react";

const MINUTE_MS = 60_000;

const listeners = new Set<() => void>();
let minute = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    minute = Math.floor(Date.now() / MINUTE_MS);
    timer = setInterval(() => {
      minute = Math.floor(Date.now() / MINUTE_MS);
      for (const notify of listeners) {
        notify();
      }
    }, MINUTE_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => minute;
const getServerSnapshot = () => 0;

/**
 * Re-renders the caller once a minute, from one shared timer however many
 * components use it, so "5 minutes ago" keeps counting on a page left open.
 */
export function useMinuteTick(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
