"use client";

import { useQuery } from "@tanstack/react-query";

import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { GEO_WEB_TRACKING_STATUS_POLL_MS } from "@/constants/geo-ingest-script";
import { dashboardOrpc } from "@/lib/orpc/query";
import { geoSettingsQueryInput } from "@/utils/geo-query-input";

/** Whether notra.js has counted the project yet; polls until the first page view. */
export function useWebTrackingStatus(organizationId: string, enabled: boolean) {
  const { projectId } = useGeoProjectScope();
  return useQuery({
    ...dashboardOrpc.geo.webTrackingStatus.queryOptions({
      input: geoSettingsQueryInput({ organizationId, projectId }),
    }),
    enabled: enabled && Boolean(organizationId),
    refetchInterval: (query) =>
      query.state.data?.firstDay ? false : GEO_WEB_TRACKING_STATUS_POLL_MS,
  });
}
