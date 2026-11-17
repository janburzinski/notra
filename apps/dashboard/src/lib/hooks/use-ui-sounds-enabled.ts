"use client";

import { useSyncExternalStore } from "react";

import {
  getServerUiSoundsEnabled,
  getUiSoundsEnabled,
  subscribeUiSoundsEnabled,
} from "@/lib/ui-sounds/store";

export function useUiSoundsEnabled() {
  return useSyncExternalStore(
    subscribeUiSoundsEnabled,
    getUiSoundsEnabled,
    getServerUiSoundsEnabled
  );
}
