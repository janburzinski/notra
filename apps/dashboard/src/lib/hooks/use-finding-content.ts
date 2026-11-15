import { queryOptions, useQuery } from "@tanstack/react-query";

import { AUTOPILOT_CONTENT_STALE_MS } from "@/constants/autopilot-brief";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotFindingView } from "@/types/autopilot";

/**
 * The post an item's pull request writes. Keyed on the head commit, so a new
 * push reads it again while an unchanged item stays cached.
 */
export function findingContentQueryOptions(
  organizationId: string,
  finding: Pick<AutopilotFindingView, "id" | "headSha" | "pullRequestNumber">
) {
  const input = { organizationId, findingId: finding.id };
  return queryOptions({
    queryKey: [
      ...dashboardOrpc.autopilot.findingContent.queryKey({ input }),
      finding.headSha,
    ],
    queryFn: ({ signal }) =>
      dashboardOrpc.autopilot.findingContent.call(input, { signal }),
    enabled: finding.pullRequestNumber !== null,
    staleTime: AUTOPILOT_CONTENT_STALE_MS,
    // A failed GitHub read fails again right away; the message says what to do.
    retry: false,
  });
}

export function useFindingContent(
  organizationId: string,
  finding: Pick<AutopilotFindingView, "id" | "headSha" | "pullRequestNumber">
) {
  return useQuery(findingContentQueryOptions(organizationId, finding));
}
