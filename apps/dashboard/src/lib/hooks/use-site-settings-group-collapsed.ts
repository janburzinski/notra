"use client";

import { useSyncExternalStore } from "react";

import { localStorageKeys } from "@/constants/storage";

// Holds choices while browser storage refuses writes.
const overrides = new Map<string, boolean>();

/** Per-user memory of which Sites settings groups are collapsed. */
export function useSiteSettingsGroupCollapsed(id: string) {
  const key = localStorageKeys.siteSettingsGroupCollapsed(id);
  const subscribe = (onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) {
        overrides.delete(key);
      }
      onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(key, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(key, onChange);
    };
  };
  const read = () => {
    const override = overrides.get(key);
    if (override !== undefined) {
      return override;
    }
    try {
      return window.localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  };
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const setCollapsed = (next: boolean) => {
    try {
      window.localStorage.setItem(key, String(next));
      overrides.delete(key);
    } catch {
      overrides.set(key, next);
    }
    window.dispatchEvent(new Event(key));
  };
  return { collapsed, setCollapsed };
}
