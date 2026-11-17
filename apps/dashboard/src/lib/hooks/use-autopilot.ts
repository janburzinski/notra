"use client";

import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { AUTOPILOT_POLL_INTERVAL_MS } from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_SYNC_STALE_MS,
} from "@/constants/autopilot-ui";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type { GitHubMergeMethod } from "@/types/integrations/github";
import { toErrorMessage } from "@/utils/error-message";

type AutopilotJobChange = {
  kind: AutopilotAutomationKind;
  enabled: boolean;
};

const setJobKey = (organizationId: string) => [
  ...dashboardOrpc.autopilot.setJob.key(),
  organizationId,
];

/** Automation switches whose save hasn't come back yet, oldest first. */
export function useSavingAutopilotJobs(organizationId: string) {
  return useMutationState({
    filters: { mutationKey: setJobKey(organizationId), status: "pending" },
    select: (mutation) => mutation.state.variables as AutopilotJobChange,
  });
}

/**
 * The workspace's Autopilot state, polled while a run or a write is in
 * flight. Admins sync GitHub at most every few minutes so merges and closes
 * made there show up.
 */
export function useAutopilotOverview(organizationId: string) {
  const queryClient = useQueryClient();
  const saving = useSavingAutopilotJobs(organizationId);
  const query = useQuery(
    dashboardOrpc.autopilot.get.queryOptions({
      input: { organizationId },
      enabled: organizationId.length > 0,
      // A poll or sync that lands mid-save still has the old switch, so
      // switches being saved win over what the server said.
      select:
        saving.length > 0
          ? (data) => ({
              ...data,
              settings: {
                ...data.settings,
                jobs: {
                  ...data.settings.jobs,
                  ...Object.fromEntries(
                    saving.map((change) => [change.kind, change.enabled])
                  ),
                },
              },
            })
          : undefined,
      refetchInterval: (state) =>
        state.state.data?.runs.some((run) => run.status === "running") ||
        state.state.data?.findings.some((finding) => finding.status === "open")
          ? AUTOPILOT_POLL_INTERVAL_MS
          : false,
    })
  );
  const canSync = Boolean(query.data?.available && query.data.canManage);
  useQuery({
    queryKey: [...dashboardOrpc.autopilot.sync.key(), organizationId],
    queryFn: async () => {
      await dashboardOrpc.autopilot.sync.call({ organizationId });
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.get.key({
          input: { organizationId },
        }),
      });
      return true;
    },
    enabled: Boolean(organizationId && canSync),
    staleTime: AUTOPILOT_SYNC_STALE_MS,
    gcTime: AUTOPILOT_SYNC_STALE_MS,
    retry: false,
    refetchOnWindowFocus: false,
  });
  return query;
}

export function useAutopilotActions(organizationId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: dashboardOrpc.autopilot.key() });

  const runNow = useMutation({
    mutationFn: (kind?: AutopilotAutomationKind) =>
      dashboardOrpc.autopilot.runNow.call({ organizationId, kind }),
    onSuccess: (result, kind) => {
      if (result.alreadyRunning) {
        toast.success("Autopilot is already running");
      } else {
        toast.success(
          kind
            ? `${AUTOPILOT_AUTOMATIONS[kind].name} is running now`
            : "Autopilot is checking your site now"
        );
      }
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not start Autopilot")),
  });

  const stop = useMutation({
    mutationFn: (runId: string) =>
      dashboardOrpc.autopilot.stop.call({ organizationId, runId }),
    onSuccess: () => {
      toast.success("Stopped. Steps already underway finish first.");
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not stop the run")),
  });

  const writeSuggestion = useMutation({
    mutationFn: (findingId: string) =>
      dashboardOrpc.autopilot.writeSuggestion.call({
        organizationId,
        findingId,
      }),
    onSuccess: () => {
      toast.success("Post queued. The pull request will appear here.");
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not start writing")),
  });

  const overviewKey = dashboardOrpc.autopilot.get.queryOptions({
    input: { organizationId },
  }).queryKey;
  const savingJobKey = setJobKey(organizationId);
  const setCachedJob = (kind: AutopilotAutomationKind, enabled: boolean) =>
    queryClient.setQueryData(overviewKey, (current) =>
      current
        ? {
            ...current,
            settings: {
              ...current.settings,
              jobs: { ...current.settings.jobs, [kind]: enabled },
            },
          }
        : current
    );
  // The switch flips at once, so a template's card leaves and its row
  // arrives on the click instead of after the round trip.
  const setJob = useMutation({
    mutationKey: savingJobKey,
    mutationFn: (input: AutopilotJobChange) =>
      dashboardOrpc.autopilot.setJob.call({ organizationId, ...input }),
    onMutate: async ({ kind, enabled }) => {
      await queryClient.cancelQueries({ queryKey: overviewKey });
      setCachedJob(kind, enabled);
    },
    onSuccess: (_, input) => {
      // A read that landed mid-save holds the old switch until the refetch.
      setCachedJob(input.kind, input.enabled);
      toast.success(
        `${AUTOPILOT_AUTOMATIONS[input.kind].name} is ${input.enabled ? "on" : "off"}`
      );
    },
    onError: (error, { kind, enabled }) => {
      setCachedJob(kind, !enabled);
      toast.error(toErrorMessage(error, "Could not change the automation"));
    },
    // A refetch mid-way through a second click would undo its card.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: savingJobKey }) === 1) {
        void invalidate();
      }
    },
  });

  const merge = useMutation({
    mutationFn: (input: {
      findingId: string;
      method?: GitHubMergeMethod;
      /** The commit on screen; the merge is refused if the branch moved on. */
      headSha?: string;
    }) => dashboardOrpc.autopilot.merge.call({ organizationId, ...input }),
    onSuccess: () => {
      toast.success("Merged");
      invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error, "Could not merge")),
  });

  const hold = useMutation({
    mutationFn: (findingId: string) =>
      dashboardOrpc.autopilot.hold.call({ organizationId, findingId }),
    onSuccess: () => {
      toast.success("Held");
      invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error, "Could not hold")),
  });

  return { runNow, stop, writeSuggestion, setJob, merge, hold };
}
