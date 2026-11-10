import { localStorageKeys } from "@/constants/storage";
import {
  DEFAULT_UI_SOUND_SETTINGS,
  UI_SOUND_CATEGORIES,
  UI_SOUND_VARIANTS,
} from "@/constants/ui-sounds";
import type { UiSoundSettings } from "@/types/ui-sounds";

const STORAGE_KEY = localStorageKeys.uiSounds;
const listeners = new Set<() => void>();
// Also holds the settings for the session when storage refuses writes.
let cached: UiSoundSettings | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Unknown or outdated fields fall back to the defaults one by one. */
function parseUiSoundSettings(raw: string | null): UiSoundSettings {
  if (!raw) {
    return DEFAULT_UI_SOUND_SETTINGS;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_UI_SOUND_SETTINGS;
  }
  if (!isRecord(data)) {
    return DEFAULT_UI_SOUND_SETTINGS;
  }
  const storedVariants = isRecord(data.variants) ? data.variants : {};
  const variants: Record<string, string> = {
    ...DEFAULT_UI_SOUND_SETTINGS.variants,
  };
  for (const category of UI_SOUND_CATEGORIES) {
    const choice = storedVariants[category];
    const known: readonly string[] = UI_SOUND_VARIANTS[category];
    if (
      typeof choice === "string" &&
      (choice === "off" || known.includes(choice))
    ) {
      variants[category] = choice;
    }
  }
  const volume =
    typeof data.volume === "number" && Number.isFinite(data.volume)
      ? Math.min(100, Math.max(0, Math.round(data.volume)))
      : DEFAULT_UI_SOUND_SETTINGS.volume;
  return {
    enabled: data.enabled === true,
    volume,
    variants: variants as UiSoundSettings["variants"],
  };
}

function readStoredSettings() {
  try {
    return parseUiSoundSettings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_UI_SOUND_SETTINGS;
  }
}

export function getUiSoundSettings(): UiSoundSettings {
  if (typeof window === "undefined") {
    return DEFAULT_UI_SOUND_SETTINGS;
  }
  cached ??= readStoredSettings();
  return cached;
}

export function getServerUiSoundSettings() {
  return DEFAULT_UI_SOUND_SETTINGS;
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

export function subscribeUiSoundSettings(listener: () => void) {
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

export function updateUiSoundSettings(
  update: (current: UiSoundSettings) => UiSoundSettings
) {
  cached = update(getUiSoundSettings());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Private mode or a full quota: keep the choice for this session.
  }
  notify();
}
