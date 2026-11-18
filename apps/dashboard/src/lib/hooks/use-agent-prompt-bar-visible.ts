"use client";

import { useQuery } from "@tanstack/react-query";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useNavVisibility } from "@/lib/hooks/use-nav-visibility";
import { usePathname } from "@/lib/navigation";
import { dashboardOrpc } from "@/lib/orpc/query";
import {
  isAutopilotFindingPathname,
  isAutopilotPathname,
} from "@/utils/dashboard-paths";

/**
 * The floating agent composer ships with Autopilot, so it shows only on the
 * Autopilot pages, and steps aside while the agent panel is open or the plan
 * doesn't include Autopilot. An item's page asks for changes to its pull
 * request in its own composer instead.
 */
export function useAgentPromptBarVisible() {
  const pathname = usePathname();
  const { active } = useRightPanel();
  const { autopilot } = useNavVisibility();
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const onAutopilot =
    autopilot &&
    isAutopilotPathname(pathname) &&
    !isAutopilotFindingPathname(pathname);
  // The same query the Autopilot page loads, so this adds no request.
  const { data: upgradeRequired } = useQuery(
    dashboardOrpc.autopilot.get.queryOptions({
      input: { organizationId },
      enabled: onAutopilot && organizationId.length > 0,
      select: (data) => data.upgradeRequired,
    })
  );
  // Hidden until the overview says the plan includes Autopilot, so the
  // composer never flashes onto the upgrade page while it loads.
  return onAutopilot && upgradeRequired === false && active !== "agent";
}
