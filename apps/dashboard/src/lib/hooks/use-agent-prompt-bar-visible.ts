"use client";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";
import { usePathname } from "@/lib/navigation";
import { isAutopilotPathname } from "@/utils/dashboard-paths";

/**
 * The floating agent composer ships with Autopilot, so it shows only on the
 * Autopilot pages, and steps aside while the agent panel is open.
 */
export function useAgentPromptBarVisible() {
  const pathname = usePathname();
  const { active } = useRightPanel();
  const { autopilot } = useNavVisibility();
  return autopilot && isAutopilotPathname(pathname) && active !== "agent";
}
