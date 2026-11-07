import {
  WORKFLOW_ERROR_POLICIES,
  WORKFLOW_IF_PORTS,
  WORKFLOW_OTHERWISE_PORT,
  WORKFLOW_SWITCH_TYPE,
} from "@notra/workflows/constants/graph";
import { getConnectablePorts } from "@notra/workflows/runtime/ports";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowPort,
} from "@notra/workflows/types/graph";
import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { AUTOPILOT_WORKFLOW_COLUMN_WIDTH } from "@/constants/autopilot-workflow";
import {
  AUTOPILOT_WORKFLOW_BLOCK_TYPES,
  AUTOPILOT_WORKFLOW_DECIDE_PORTS,
  AUTOPILOT_WORKFLOW_SAVE_TOOL_NAME,
  AUTOPILOT_WORKFLOW_STEP_LOOK,
} from "@/constants/autopilot-workflows";
import type {
  AutopilotWorkflowChange,
  AutopilotWorkflowDraft,
  AutopilotWorkflowDraftPart,
  AutopilotWorkflowDraftStatus,
  AutopilotWorkflowSavedVersion,
} from "@/types/autopilot-workflows";
import type {
  WorkflowRunView,
  WorkflowRunViewNode,
} from "@/types/workflow-engine";
import {
  autopilotWorkflowSettingValue,
  buildAutopilotWorkflowGraph,
  describeAutopilotWorkflowSchedule,
  triggerTitle,
} from "@/utils/autopilot-workflows";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stepLook(type: string) {
  return Object.hasOwn(AUTOPILOT_WORKFLOW_STEP_LOOK, type)
    ? AUTOPILOT_WORKFLOW_STEP_LOOK[type]
    : undefined;
}

function errorPolicy(value: unknown): WorkflowNode["onError"] {
  return WORKFLOW_ERROR_POLICIES.find((policy) => policy === value);
}

/** The branches a step can take, as the saved workflow will have them. */
function branchPorts(node: WorkflowNode): WorkflowPort[] {
  if (node.type === AUTOPILOT_WORKFLOW_BLOCK_TYPES.decide) {
    return AUTOPILOT_WORKFLOW_DECIDE_PORTS;
  }
  if (node.type === "core.if") {
    return WORKFLOW_IF_PORTS;
  }
  if (node.type === WORKFLOW_SWITCH_TYPE) {
    const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
    return [
      ...cases.flatMap((value) => {
        const id = text(record(value)?.id);
        const label = text(record(value)?.label);
        return id ? [label ? { id, label } : { id }] : [];
      }),
      { id: WORKFLOW_OTHERWISE_PORT, label: "Otherwise" },
    ];
  }
  return [];
}

/**
 * The steps and connections streamed in so far. While the call still
 * streams, its last step or connection may be cut off mid-word, so it waits.
 */
function readGraph(input: Record<string, unknown>, streaming: boolean) {
  const rawNodes = Array.isArray(input.nodes) ? input.nodes : [];
  const rawEdges = Array.isArray(input.edges) ? input.edges : [];
  const settledNodes =
    streaming && rawEdges.length === 0 ? rawNodes.slice(0, -1) : rawNodes;
  const settledEdges = streaming ? rawEdges.slice(0, -1) : rawEdges;

  const ids = new Set<string>();
  const nodes = settledNodes.flatMap((value): WorkflowNode[] => {
    const node = record(value);
    const id = text(node?.id);
    const type = text(node?.type);
    const title = text(node?.title);
    if (!(node && id && type && title) || ids.has(id)) {
      return [];
    }
    ids.add(id);
    return [
      {
        id,
        type,
        title,
        description: text(node.description) ?? undefined,
        config: record(node.config) ?? undefined,
        onError: errorPolicy(node.onError),
      },
    ];
  });
  const edgeKeys = new Set<string>();
  const edges = settledEdges.flatMap((value) => {
    const edge = record(value);
    const source = text(edge?.source);
    const target = text(edge?.target);
    const sourcePort = text(edge?.sourcePort) ?? undefined;
    const key = `${source}:${sourcePort ?? ""}:${target}`;
    if (
      !(source && target && ids.has(source) && ids.has(target)) ||
      edgeKeys.has(key)
    ) {
      return [];
    }
    edgeKeys.add(key);
    return [{ source, target, sourcePort }];
  });

  const graph = buildAutopilotWorkflowGraph({ nodes, edges });
  // Steps stream in before their connections. A step nothing leads into yet
  // waits in its own column to the right, instead of piling up under the
  // trigger and jumping once its connection arrives.
  const connected = new Set(edges.map((edge) => edge.target));
  const lastColumn = Math.max(
    0,
    ...graph.nodes
      .filter((node, index) => index === 0 || connected.has(node.id))
      .map((node) => node.position?.x ?? 0)
  );
  let waiting = 0;
  return {
    ...graph,
    nodes: graph.nodes.map((node, index) => {
      if (index === 0 || connected.has(node.id)) {
        return node;
      }
      waiting += 1;
      return {
        ...node,
        position: {
          x: lastColumn + waiting * AUTOPILOT_WORKFLOW_COLUMN_WIDTH,
          y: 0,
        },
      };
    }),
  };
}

function draftStatus(
  part: AutopilotWorkflowDraftPart
): AutopilotWorkflowDraftStatus {
  switch (part.state) {
    case "approval-requested": {
      return "awaiting-approval";
    }
    // Answered, before the agent picks it up again.
    case "approval-responded": {
      return part.approval?.approved === false ? "discarded" : "saving";
    }
    case "output-denied": {
      return "discarded";
    }
    case "output-error": {
      return "failed";
    }
    case "output-available": {
      const output = record(part.output);
      if (output?.ok === true) {
        return "saved";
      }
      return Array.isArray(output?.issues) ? "needs-fixes" : "failed";
    }
    default: {
      return "drafting";
    }
  }
}

function readSchedule(value: unknown): AutopilotWorkflowDraft["schedule"] {
  const schedule = record(value);
  if (
    !(
      schedule &&
      typeof schedule.hour === "number" &&
      typeof schedule.minute === "number" &&
      (schedule.frequency === "daily" ||
        schedule.frequency === "weekly" ||
        schedule.frequency === "monthly")
    )
  ) {
    return null;
  }
  return {
    frequency: schedule.frequency,
    hour: schedule.hour,
    minute: schedule.minute,
    dayOfWeek:
      typeof schedule.dayOfWeek === "number" ? schedule.dayOfWeek : undefined,
    dayOfMonth:
      typeof schedule.dayOfMonth === "number" ? schedule.dayOfMonth : undefined,
  };
}

/** Reads the agent's save call, while it streams and after it ran, as a preview. */
export function readAutopilotWorkflowDraft(
  part: AutopilotWorkflowDraftPart
): AutopilotWorkflowDraft | null {
  const input = record(part.input);
  if (!input) {
    return null;
  }
  const graph = readGraph(input, part.state === "input-streaming");
  const schedule = readSchedule(input.schedule);
  const output = record(part.output);
  const view: WorkflowRunView = {
    id: part.toolCallId,
    title: text(input.name) ?? "",
    parentRunId: null,
    startedAt: null,
    nodes: graph.nodes.map(({ config, ...node }) => ({
      ...node,
      // Saving names the trigger after the schedule; the preview does too.
      title:
        node.type === "core.trigger" && input.schedule !== undefined
          ? triggerTitle(schedule)
          : node.title,
      kind: stepLook(node.type)?.kind,
      logo: stepLook(node.type)?.logo ?? null,
      outputs: getConnectablePorts({
        outputs: branchPorts({ ...node, config }),
        onError: node.onError,
      }),
      status: null,
      port: null,
      output: null,
      error: null,
      reason: null,
      startedAt: null,
      finishedAt: null,
      steps: [],
      settings: Object.entries(config ?? {})
        .filter(([, value]) => value !== undefined)
        .map(([label, value]) => ({
          label,
          value: autopilotWorkflowSettingValue(value),
        })),
    })),
    edges: graph.edges.map((edge) => ({ ...edge, taken: null })),
  };
  return {
    toolCallId: part.toolCallId,
    approvalId:
      part.state === "approval-requested" ? (part.approval?.id ?? null) : null,
    workflowId: text(input.workflowId),
    isChange: text(input.workflowId) !== null,
    name: text(input.name),
    description: text(input.description),
    schedule,
    view,
    status: draftStatus(part),
    path: text(output?.path),
    issues: Array.isArray(output?.issues)
      ? output.issues.filter(
          (issue): issue is string => typeof issue === "string"
        )
      : [],
  };
}

/** The workflow the agent wrote last in this conversation, if any. */
export function findAutopilotWorkflowDraft(messages: readonly UIMessage[]) {
  for (const message of messages.toReversed()) {
    if (message.role !== "assistant") {
      continue;
    }
    const part = message.parts.findLast(
      (item) =>
        isToolUIPart(item) &&
        getToolName(item) === AUTOPILOT_WORKFLOW_SAVE_TOOL_NAME
    );
    if (part && isToolUIPart(part)) {
      const draft = readAutopilotWorkflowDraft(part);
      if (draft) {
        return draft;
      }
    }
  }
  return null;
}

function settingsOf(node: Pick<WorkflowRunViewNode, "settings">) {
  return new Map(
    (node.settings ?? []).map(({ label, value }) => [label, value])
  );
}

function sameSettings(
  a: Pick<WorkflowRunViewNode, "settings">,
  b: Pick<WorkflowRunViewNode, "settings">
) {
  const before = settingsOf(a);
  const after = settingsOf(b);
  return (
    before.size === after.size &&
    [...after].every(([label, value]) => before.get(label) === value)
  );
}

/** Each step's incoming connections, with the branch they leave from. */
function incomingOf(edges: WorkflowEdge[]) {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const from = `${edge.source}:${edge.sourcePort ?? ""}`;
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), from]);
  }
  return new Map(
    [...incoming].map(([target, sources]) => [target, sources.sort().join("|")])
  );
}

/**
 * What a proposed change does to the saved workflow, in the order people
 * scan it: when it runs, its name, then its steps. The trigger is named
 * after the schedule, so its title doesn't count as a change of its own.
 */
export function describeAutopilotWorkflowChanges(
  saved: AutopilotWorkflowSavedVersion,
  draft: Pick<
    AutopilotWorkflowDraft,
    "name" | "description" | "schedule" | "view"
  >
): AutopilotWorkflowChange[] {
  const changes: AutopilotWorkflowChange[] = [];
  const from = describeAutopilotWorkflowSchedule(saved.schedule);
  const to = describeAutopilotWorkflowSchedule(draft.schedule);
  if (from !== to) {
    changes.push({ kind: "schedule", from, to });
  }
  if (draft.name && draft.name !== saved.name) {
    changes.push({ kind: "name", from: saved.name, to: draft.name });
  }
  // Leaving the description out keeps the saved one.
  if (draft.description && draft.description !== saved.description) {
    changes.push({ kind: "description" });
  }
  // Moving a step to another branch changes what runs, even when no step's
  // own settings do.
  const wiredBefore = incomingOf(saved.view.edges);
  const wiredAfter = incomingOf(draft.view.edges);
  const before = new Map(saved.view.nodes.map((node) => [node.id, node]));
  const after = new Map(draft.view.nodes.map((node) => [node.id, node]));
  for (const node of draft.view.nodes) {
    const old = before.get(node.id);
    if (!old) {
      changes.push({ kind: "added", id: node.id, title: node.title });
      continue;
    }
    // The trigger is named after the schedule, reported above.
    const edited =
      node.type !== "core.trigger" &&
      (old.title !== node.title ||
        old.type !== node.type ||
        (old.description ?? null) !== (node.description ?? null) ||
        (old.onError ?? null) !== (node.onError ?? null) ||
        !sameSettings(old, node));
    if (edited) {
      changes.push({ kind: "changed", id: node.id, title: node.title });
    } else if (
      (wiredBefore.get(node.id) ?? "") !== (wiredAfter.get(node.id) ?? "")
    ) {
      changes.push({ kind: "rewired", id: node.id, title: node.title });
    }
  }
  for (const node of saved.view.nodes) {
    if (!after.has(node.id)) {
      changes.push({ kind: "removed", id: node.id, title: node.title });
    }
  }
  return changes;
}
