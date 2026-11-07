"use client";

import { useState } from "react";
import { WorkflowCanvas } from "ui/workflow/canvas";
import { WorkflowNodeSheet } from "ui/workflow/node-sheet";

import { AUTOPILOT_WORKFLOW_PREVIEW_FIT_MIN_ZOOM } from "@/constants/autopilot-ui";
import type { AutopilotWorkflowDraftCanvasProps } from "@/types/autopilot-workflows";
import { readableAutopilotWorkflowSettings } from "@/utils/autopilot-workflows";
import {
  toWorkflowCanvasEdges,
  toWorkflowCanvasNodes,
} from "@/utils/workflow-run-view";

/** The workflow the agent is writing, on the workflow canvas, growing as it streams. */
export function AutopilotWorkflowDraftCanvas({
  draft,
  className,
}: AutopilotWorkflowDraftCanvasProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const [open, setOpen] = useState(false);
  const titles = new Map(draft.view.nodes.map((node) => [node.id, node.title]));
  const settings = new Map(
    draft.view.nodes.map((node) => [
      node.id,
      readableAutopilotWorkflowSettings(node.settings ?? [], titles),
    ])
  );
  // A draft hasn't run, so its steps show their settings and the usual
  // estimate instead of results and timings.
  const nodes = toWorkflowCanvasNodes(draft.view).map((node) => ({
    ...node,
    durationMs: undefined,
    fields: settings.get(node.id) ?? [],
  }));
  const selected = nodes.find((node) => node.id === selectedId);
  const drafting = draft.status === "drafting";

  return (
    <>
      <WorkflowCanvas
        autoFit={drafting}
        // Once saved, start over from the first step so it reads left to right.
        key={`${draft.toolCallId}:${drafting}`}
        className={className}
        edges={toWorkflowCanvasEdges(draft.view)}
        // A preview should show the whole workflow, even a little smaller.
        fitMinZoom={AUTOPILOT_WORKFLOW_PREVIEW_FIT_MIN_ZOOM}
        nodes={nodes}
        onSelectNode={(id) => {
          setSelectedId(id);
          setOpen(true);
        }}
        selectedId={open ? selectedId : undefined}
      />
      <WorkflowNodeSheet node={selected} onOpenChange={setOpen} open={open} />
    </>
  );
}
