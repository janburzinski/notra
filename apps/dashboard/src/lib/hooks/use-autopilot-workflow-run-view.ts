"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { AUTOPILOT_WORKFLOW_POLL_MS } from "@/constants/autopilot-workflows";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotWorkflowPageProps } from "@/types/autopilot-workflows";
import {
  hasSameAutopilotWorkflowSteps,
  isAutopilotWorkflowRunActive,
} from "@/utils/autopilot-workflows";

/**
 * The run a workflow's page shows: the latest unless one is picked, polled
 * while it runs. After a change, the latest run shows steps the workflow no
 * longer has, so the page shows the current version until a run is picked.
 */
export function useAutopilotWorkflowRunView(
  organizationId: string,
  workflow: AutopilotWorkflowPageProps["workflow"]
) {
  const [pickedRunId, setPickedRunId] = useState<string | null>(null);
  const [latestRun] = workflow.runs;
  const shownRun =
    workflow.runs.find((item) => item.id === pickedRunId) ?? latestRun;
  const runActive = shownRun ? isAutopilotWorkflowRunActive(shownRun) : false;
  const runView = useQuery(
    dashboardOrpc.autopilot.workflows.runGraph.queryOptions({
      input: { organizationId, runId: shownRun?.id ?? "" },
      enabled: Boolean(shownRun),
      refetchInterval: runActive ? AUTOPILOT_WORKFLOW_POLL_MS : false,
    })
  );
  const { refetch } = runView;
  const wasActiveRef = useRef(runActive);
  useEffect(() => {
    // One last fetch when the run settles, so the final step states show.
    if (wasActiveRef.current && !runActive) {
      // react-doctor-disable-next-line react-doctor/query-no-query-in-effect -- polling stops when the run settles; this one fetch picks up the final step states, a transition the query key can't express
      refetch().catch(() => undefined);
    }
    wasActiveRef.current = runActive;
  }, [refetch, runActive]);
  const [runShownView] = shownRun ? (runView.data ?? []) : [];
  const changedSinceRun = Boolean(
    !pickedRunId &&
    runShownView &&
    !hasSameAutopilotWorkflowSteps(runShownView, workflow.view)
  );
  return {
    latestRun,
    shownRun,
    running: workflow.runs.some(isAutopilotWorkflowRunActive),
    changedSinceRun,
    shownView: changedSinceRun ? undefined : runShownView,
    setPickedRunId,
  };
}
