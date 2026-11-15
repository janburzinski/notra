"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ARTIFACT_AUTOPILOT_REFRESH_MS } from "@/constants/artifacts";
import { AUTOPILOT_POLL_INTERVAL_MS } from "@/constants/autopilot";
import { dashboardOrpc } from "@/lib/orpc/query";

export function artifactQueryOptions(params: {
  organizationId: string;
  artifactId: string;
  version?: number | null;
}) {
  return dashboardOrpc.artifacts.get.queryOptions({
    input: {
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      version: params.version ?? undefined,
    },
  });
}

/**
 * One artifact for a member. Picking another version keeps the current one
 * on screen until it loads. Autopilot items on it refresh while they can
 * still change: quickly while one is being written, slowly while waiting.
 */
export function useArtifact(params: {
  organizationId: string;
  artifactId: string | null;
  version: number | null;
  enabled?: boolean;
}) {
  return useQuery({
    ...artifactQueryOptions({
      organizationId: params.organizationId,
      artifactId: params.artifactId ?? "",
      version: params.version,
    }),
    enabled: Boolean(params.artifactId) && params.enabled !== false,
    placeholderData: keepPreviousData,
    retry: false,
    refetchInterval: (query) => {
      const findings = query.state.data?.autopilot?.findings ?? [];
      if (findings.some((finding) => finding.status === "open")) {
        return AUTOPILOT_POLL_INTERVAL_MS;
      }
      return findings.some(
        (finding) =>
          finding.status === "proposed" || finding.status === "suggested"
      )
        ? ARTIFACT_AUTOPILOT_REFRESH_MS
        : false;
    },
  });
}
