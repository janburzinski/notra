"use client";

import { useEffect } from "react";

import { useUiSoundsEnabled } from "@/lib/hooks/use-ui-sounds-enabled";
import { installUiSoundListeners } from "@/lib/ui-sounds/listeners";

/** Listens for interactions only while the user has sounds turned on. */
export function UiSounds() {
  const enabled = useUiSoundsEnabled();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return installUiSoundListeners();
  }, [enabled]);

  return null;
}
