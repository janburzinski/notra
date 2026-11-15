"use client";

import {
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotSettingsPatch,
  AutopilotSettingsPendingChange,
  AutopilotSettingsView,
} from "@/types/autopilot";
import { applyAutopilotSettingsPatch } from "@/utils/autopilot-settings";
import { toErrorMessage } from "@/utils/error-message";

/**
 * Every settings change saves on its own and shows at once.
 *
 * A save sends only the change itself and the server merges it into the
 * saved settings, so nothing the page holds (a stale poll, a change that
 * failed, a remount) can write an old value back. Changes on their way are
 * read from the mutation cache, which outlives this component, and drawn
 * over the loaded settings until their save lands.
 */
export function useAutopilotSettingsSave(
  organizationId: string,
  loaded: AutopilotSettingsView
) {
  const queryClient = useQueryClient();
  const overviewKey = dashboardOrpc.autopilot.get.queryKey({
    input: { organizationId },
  });
  const mutationKey = ["autopilot-settings", organizationId];

  const pending = useMutationState({
    filters: { mutationKey, status: "pending" },
    select: (mutation) =>
      mutation.state.variables as AutopilotSettingsPendingChange,
  });

  /** A saved change goes into the loaded settings right away. */
  const confirm = (change: AutopilotSettingsPendingChange) => {
    queryClient.setQueryData(overviewKey, (overview) =>
      overview
        ? {
            ...overview,
            settings: applyAutopilotSettingsPatch(overview.settings, change),
          }
        : overview
    );
    // Cancels any fetch that started before the save, so the cache can only
    // get settings that already include it.
    queryClient
      .invalidateQueries({ queryKey: dashboardOrpc.autopilot.key() })
      .catch(() => undefined);
  };
  const onError = (error: Error) =>
    toast.error(toErrorMessage(error, "Could not save the change"));

  // Saves still go out in order, so two quick picks for one setting land in
  // the order they were made.
  const save = useMutation({
    mutationKey,
    scope: { id: `autopilot-settings:${organizationId}` },
    mutationFn: (patch: AutopilotSettingsPatch) =>
      dashboardOrpc.autopilot.update.call({ organizationId, ...patch }),
    onSuccess: (_data, patch) => confirm(patch),
    onError,
  });

  // A job of its own, switched atomically like the automations.
  const promptCleanup = useMutation({
    mutationKey,
    mutationFn: ({ jobs }: { jobs: { prompts: boolean } }) =>
      dashboardOrpc.autopilot.setJob.call({
        organizationId,
        kind: "prompts",
        enabled: jobs.prompts,
      }),
    onSuccess: (_data, change) => confirm(change),
    onError,
  });

  return {
    // Turning Autopilot off swaps the whole page, so that waits for its save.
    settings: pending
      .filter((change) => change.enabled !== false)
      .reduce(applyAutopilotSettingsPatch, loaded),
    save,
    setPromptCleanup: (enabled: boolean) =>
      promptCleanup.mutate({ jobs: { prompts: enabled } }),
  };
}
