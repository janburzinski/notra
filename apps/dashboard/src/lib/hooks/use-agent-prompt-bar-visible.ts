"use client";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";
import { usePathname } from "@/lib/navigation";
import {
  isChatPathname,
  isContentDetailPathname,
} from "@/utils/dashboard-paths";

/**
 * The floating agent composer ships with Autopilot, so it shows only where
 * the Autopilot flag is on, and steps aside where another composer shows.
 */
export function useAgentPromptBarVisible() {
  const pathname = usePathname();
  const { active } = useRightPanel();
  const { autopilot } = useNavVisibility();
  return (
    autopilot &&
    !(
      active === "agent" ||
      isChatPathname(pathname) ||
      isContentDetailPathname(pathname)
    )
  );
}
