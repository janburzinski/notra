"use client";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAnalyticsImportNotices } from "@/lib/hooks/use-analytics-import-notices";
import { useAnalyticsImports } from "@/lib/hooks/use-analytics-imports";
import { useWebAnalyticsFlag } from "@/lib/hooks/use-web-analytics-flag";

/**
 * Follows the workspace's imports anywhere in the dashboard: it polls only
 * while one is active, refreshes charts when one finishes and announces it
 * once.
 */
export function AnalyticsImportWatcher() {
  const { activeOrganization } = useOrganizationsContext();
  const webFlag = useWebAnalyticsFlag();
  const { data } = useAnalyticsImports(
    activeOrganization?.id ?? "",
    null,
    webFlag.enabled
  );
  useAnalyticsImportNotices(data?.imports);
  return null;
}
