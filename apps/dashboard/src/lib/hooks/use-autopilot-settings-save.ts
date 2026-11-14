"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotSettingsPatch,
  AutopilotSettingsView,
} from "@/types/autopilot";
import { toAutopilotSaveInput } from "@/utils/autopilot-settings";
import { toErrorMessage } from "@/utils/error-message";

/** Every settings change saves on its own; there is no form to submit. */
export function useAutopilotSettingsSave(
  organizationId: string,
  settings: AutopilotSettingsView
) {
  const queryClient = useQueryClient();
  const overviewKey = dashboardOrpc.autopilot.get.queryKey({
    input: { organizationId },
  });
  // Saves run one after another, each on top of the refetched settings, so a
  // quick second change never resends the value the first one replaced.
  const save = useMutation({
    scope: { id: `autopilot-settings:${organizationId}` },
    mutationFn: (
      patch:
        | AutopilotSettingsPatch
        | ((current: AutopilotSettingsView) => AutopilotSettingsPatch)
    ) => {
      const current =
        queryClient.getQueryData(overviewKey)?.settings ?? settings;
      return dashboardOrpc.autopilot.save.call({
        ...toAutopilotSaveInput(organizationId, current),
        ...(typeof patch === "function" ? patch(current) : patch),
      });
    },
    // The next queued save builds on the refetched settings, even after a
    // quick navigation, so it waits for those alone. The rest of Autopilot
    // (repositories, author suggestions) can take a while and refreshes in
    // the background.
    onSuccess: async () => {
      queryClient
        .invalidateQueries({
          queryKey: dashboardOrpc.autopilot.key(),
          predicate: (query) =>
            JSON.stringify(query.queryKey) !== JSON.stringify(overviewKey),
        })
        .catch(() => undefined);
      await queryClient.invalidateQueries({
        queryKey: overviewKey,
        refetchType: "all",
      });
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the change")),
  });

  // A job of its own, switched atomically like the automations so it can't
  // undo a toggle made elsewhere a moment before.
  const setPromptCleanup = useMutation({
    mutationFn: (enabled: boolean) =>
      dashboardOrpc.autopilot.setJob.call({
        organizationId,
        kind: "prompts",
        enabled,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      }),
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the change")),
  });

  return { save, setPromptCleanup };
}
