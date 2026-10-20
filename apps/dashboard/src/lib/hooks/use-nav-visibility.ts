"use client";

import { useFlag } from "@databuddy/sdk/react";
import { isDemoModeClient } from "@notra/utils/demo-mode";

import { SOCIAL_ANALYTICS_FLAG_KEY } from "@/constants/analytics";
import { AUTOPILOT_FLAG_KEY } from "@/constants/autopilot";
import { SITES_FLAG_KEY } from "@/constants/sites";
import type { NavVisibility } from "@/types/components/nav";

function isFlagVisibleInNav(flagOn: boolean): boolean {
  return (
    !isDemoModeClient() && (flagOn || process.env.NODE_ENV === "development")
  );
}

export function useNavVisibility(): NavVisibility {
  const autopilotFlag = useFlag(AUTOPILOT_FLAG_KEY);
  const analyticsFlag = useFlag(SOCIAL_ANALYTICS_FLAG_KEY);
  const sitesFlag = useFlag(SITES_FLAG_KEY);

  return {
    autopilot: isFlagVisibleInNav(autopilotFlag.on),
    analytics: isFlagVisibleInNav(analyticsFlag.on),
    sites: !isDemoModeClient() && sitesFlag.status === "ready" && sitesFlag.on,
  };
}
