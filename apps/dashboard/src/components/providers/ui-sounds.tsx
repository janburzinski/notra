"use client";

import { useEffect } from "react";

import { useUiSoundSettings } from "@/lib/hooks/use-ui-sound-settings";
import { installUiSoundListeners } from "@/lib/ui-sounds/listeners";

/** Listens for interactions only while the user has sounds turned on. */
export function UiSounds() {
  const { enabled } = useUiSoundSettings();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return installUiSoundListeners();
  }, [enabled]);

  return null;
}
