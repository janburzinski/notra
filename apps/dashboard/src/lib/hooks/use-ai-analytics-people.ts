"use client";

import { useWebAnalyticsBreakdowns } from "@/lib/hooks/use-geo";
import { useWebAnalyticsFlag } from "@/lib/hooks/use-web-analytics-flag";
import type {
  AiAnalyticsPeople,
  TrafficPageScope,
} from "@/types/geo-traffic-pages";
import {
  hasPreviousWebPeriod,
  hasWebAnalytics,
  hasWebHosts,
  withWebBreakdowns,
} from "@/utils/web-analytics";

/** Without web analytics, the AI analytics page shows people next to AI agents. */
export function useAiAnalyticsPeople(
  scope: TrafficPageScope
): AiAnalyticsPeople {
  const webFlag = useWebAnalyticsFlag();
  const withPeople = webFlag.settled && !webFlag.enabled;
  const show =
    withPeople &&
    (hasWebAnalytics(scope.web) ||
      (scope.pathQuery !== "" && hasWebHosts(scope.web)));
  const {
    data: breakdowns,
    isPending: isBreakdownsPending,
    isPlaceholderData: isBreakdownsPlaceholder,
  } = useWebAnalyticsBreakdowns(
    scope.organizationId,
    scope.geoRange.query,
    scope.hostQuery,
    scope.pathQuery,
    scope.sites,
    show
  );
  const breakdownsStale = isBreakdownsPlaceholder || scope.isWebPending;
  return {
    show,
    web: withWebBreakdowns(scope.web, breakdownsStale ? undefined : breakdowns),
    breakdownsPending: isBreakdownsPending || breakdownsStale,
    hasPreviousData: withPeople && hasPreviousWebPeriod(scope.web),
    hasData: withPeople && (scope.isWebPending || hasWebAnalytics(scope.web)),
    // Until the flag answers, a page with people on it waits, so the people
    // section never flashes in or out.
    isPending:
      (!(webFlag.settled && webFlag.enabled) && scope.isWebPending) ||
      (!webFlag.settled && hasWebHosts(scope.web)),
  };
}
