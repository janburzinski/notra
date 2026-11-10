"use client";

import { useSyncExternalStore } from "react";

import {
  getServerUiSoundSettings,
  getUiSoundSettings,
  subscribeUiSoundSettings,
} from "@/lib/ui-sounds/store";

export function useUiSoundSettings() {
  return useSyncExternalStore(
    subscribeUiSoundSettings,
    getUiSoundSettings,
    getServerUiSoundSettings
  );
}
