"use client";

import { useQuery } from "@tanstack/react-query";

import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { WEB_ANALYTICS_FLAG_STALE_MS } from "@/constants/web-analytics";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { WebAnalyticsFlagStatus } from "@/types/components/nav";

/**
 * The server's web analytics flag for the active workspace. The organization
 * shell seeds it during SSR, so it is settled on first paint; it is only
 * unsettled after a client-side switch to a workspace not yet asked about.
 */
export function useWebAnalyticsFlag(): WebAnalyticsFlagStatus {
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const { data, isError } = useQuery({
    ...dashboardOrpc.geo.webAnalyticsEnabled.queryOptions({
      input: { organizationId },
    }),
    enabled: organizationId !== "",
    staleTime: WEB_ANALYTICS_FLAG_STALE_MS,
  });
  // A failed lookup settles as off, like the server's fail-closed answer.
  return { enabled: data === true, settled: data !== undefined || isError };
}
