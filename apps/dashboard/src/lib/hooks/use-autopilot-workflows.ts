"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { AUTOPILOT_WORKFLOW_WRITE_TOOLS } from "@/constants/autopilot-workflows";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotWorkflowEnabledInput } from "@/types/autopilot-workflows";
import { toErrorMessage } from "@/utils/error-message";

export function useAutopilotWorkflowActions(organizationId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.autopilot.workflows.key(),
    });

  const run = useMutation({
    mutationFn: (workflowId: string) =>
      dashboardOrpc.autopilot.workflows.run.call({
        organizationId,
        workflowId,
      }),
    onSuccess: () => {
      toast.success("The workflow is running now");
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not start the workflow")),
  });

  const setEnabled = useMutation({
    mutationFn: (input: AutopilotWorkflowEnabledInput) =>
      dashboardOrpc.autopilot.workflows.setEnabled.call({
        organizationId,
        ...input,
      }),
    onSuccess: (result, input) => {
      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(`The workflow is ${input.enabled ? "on" : "off"}`);
      }
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not change the workflow")),
  });

  const remove = useMutation({
    mutationFn: (workflowId: string) =>
      dashboardOrpc.autopilot.workflows.delete.call({
        organizationId,
        workflowId,
      }),
    onSuccess: (_result, workflowId) => {
      toast.success("Workflow deleted");
      // Its page is going away; refetching it would only find nothing.
      queryClient.removeQueries({
        queryKey: dashboardOrpc.autopilot.workflows.get.key({
          input: { organizationId, workflowId },
        }),
      });
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.workflows.list.key(),
      });
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not delete the workflow")),
  });

  return { run, setEnabled, remove };
}

/**
 * Once the agent saves or runs a workflow, the pages showing it refetch, so
 * a change made in the chat shows on the page behind it right away.
 */
export function useAgentWorkflowRefresh(messages: readonly UIMessage[]) {
  const queryClient = useQueryClient();
  const seenRef = useRef(new Set<string>());
  useEffect(() => {
    let changed = false;
    for (const message of messages) {
      for (const part of message.parts) {
        if (
          isToolUIPart(part) &&
          part.state === "output-available" &&
          AUTOPILOT_WORKFLOW_WRITE_TOOLS.has(getToolName(part)) &&
          !seenRef.current.has(part.toolCallId)
        ) {
          seenRef.current.add(part.toolCallId);
          changed = true;
        }
      }
    }
    if (changed) {
      queryClient
        .invalidateQueries({
          queryKey: dashboardOrpc.autopilot.workflows.key(),
        })
        .catch(() => undefined);
    }
  }, [messages, queryClient]);
}
