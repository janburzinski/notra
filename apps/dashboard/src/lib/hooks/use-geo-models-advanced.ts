"use client";

import { useSyncExternalStore } from "react";

import { localStorageKeys } from "@/constants/storage";

const KEY = localStorageKeys.geoModelsAdvanced;

// Holds the choice while browser storage refuses writes.
let override: boolean | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(KEY, onChange);
  };
}

function read() {
  if (override !== null) {
    return override;
  }
  try {
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

/** Per-user preference to pick GEO models by hand. */
export function useGeoModelsAdvanced() {
  const advanced = useSyncExternalStore(subscribe, read, () => false);
  const setAdvanced = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, String(next));
      override = null;
    } catch {
      override = next;
    }
    window.dispatchEvent(new Event(KEY));
  };
  return { advanced, setAdvanced };
}
