"use client";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { useAnalyticsImportNotices } from "@/lib/hooks/use-analytics-import-notices";
import { useAnalyticsImports } from "@/lib/hooks/use-analytics-imports";

/**
 * Follows the workspace's imports anywhere in the dashboard: it polls only
 * while one is active, refreshes charts when one finishes and announces it
 * once.
 */
export function AnalyticsImportWatcher() {
  const { activeOrganization } = useOrganizationsContext();
  const { data } = useAnalyticsImports(activeOrganization?.id ?? "", null);
  useAnalyticsImportNotices(data?.imports);
  return null;
}
