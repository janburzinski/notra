import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { useBattleCanvas } from "@/lib/mcp-battle/use-battle-canvas";
import type { McpHeroBattleProps } from "@/types/mcp";
import {
  getReducedMotionServerSnapshot,
  getReducedMotionSnapshot,
  subscribeToReducedMotion,
} from "@/utils/reduced-motion";

/**
 * Claude, ChatGPT and Cursor shoot it out behind the hero, now and then against a giant Claude boss.
 * Clicking empty sky drops a Notra strike.
 */
export function McpHeroBattle({ avoidRef, areaRef }: McpHeroBattleProps) {
  const stageRef = useBattleCanvas(
    { avoidRef, areaRef },
    {
      dark: useTheme().resolvedTheme === "dark",
      reducedMotion: useSyncExternalStore(
        subscribeToReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot
      ),
    }
  );

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden opacity-90 dark:opacity-80"
      ref={stageRef}
    />
  );
}
