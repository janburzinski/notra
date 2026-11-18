import {
  COMPOSER_ELEVATED_SHADOW,
  COMPOSER_PILL_RADIUS,
  COMPOSER_TRAY_TRANSITION,
} from "@notra/ui/constants/composer";
import { cn } from "@notra/ui/lib/utils";

import { AUTOPILOT_AGENT_DOCK_FULLSCREEN_CLASS } from "@/constants/autopilot-ui";
import type { AutopilotAgentDockMode } from "@/types/autopilot-workflows";

export function dockLayerClass(fullscreen: boolean) {
  return fullscreen
    ? "absolute inset-0 z-30"
    : "pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4";
}

/**
 * `shelled` holds the shell from the moment the dock opens until the
 * conversation has folded away again. It comes on at once, so the page never
 * shows through the conversation as it grows, and only fades once the
 * conversation is gone.
 */
export function dockClass(mode: AutopilotAgentDockMode, shelled: boolean) {
  if (mode === "fullscreen") {
    return AUTOPILOT_AGENT_DOCK_FULLSCREEN_CLASS;
  }
  return cn(
    // Open, the dock always fills this height: the conversation gives up
    // whatever room the questions take, in the same layout pass, so the dock
    // itself never moves.
    "pointer-events-auto flex max-h-[min(41rem,calc(100svh-8rem))] w-full max-w-2xl flex-col border",
    // The pill's own corners, so the open dock and the pill line up.
    COMPOSER_PILL_RADIUS,
    shelled
      ? cn("bg-shell border-shell-border p-1", COMPOSER_ELEVATED_SHADOW)
      : cn("border-transparent bg-transparent", COMPOSER_TRAY_TRANSITION)
  );
}
