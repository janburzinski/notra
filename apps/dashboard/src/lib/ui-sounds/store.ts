import { localStorageKeys } from "@/constants/storage";

const STORAGE_KEY = localStorageKeys.uiSounds;
const listeners = new Set<() => void>();
// Also holds the choice for the session when storage refuses writes.
let cached: boolean | null = null;

function readStoredEnabled() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const data: unknown = raw ? JSON.parse(raw) : null;
    return (
      typeof data === "object" &&
      data !== null &&
      "enabled" in data &&
      data.enabled === true
    );
  } catch {
    return false;
  }
}

export function getUiSoundsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  cached ??= readStoredEnabled();
  return cached;
}

export function getServerUiSoundsEnabled() {
  return false;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function onStorage(event: StorageEvent) {
  // `key` is null when another tab clears all of storage.
  if (event.key === STORAGE_KEY || event.key === null) {
    cached = null;
    notify();
  }
}

export function subscribeUiSoundsEnabled(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function setUiSoundsEnabled(enabled: boolean) {
  cached = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }));
  } catch {
    // Private mode or a full quota: keep the choice for this session.
  }
  notify();
}
