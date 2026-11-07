import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import type { AutopilotWorkflowSchedule } from "@notra/db/types/workflows";
import type {
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from "@notra/workflows/types/graph";
import { nanoid } from "nanoid";

import { DAY_MS } from "@/constants/analytics-weekdays";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import {
  AUTOPILOT_AUTOMATION_SLUGS,
  AUTOPILOT_AUTOMATIONS,
} from "@/constants/autopilot-ui";
import {
  AUTOPILOT_WORKFLOW_COLUMN_WIDTH as COLUMN,
  AUTOPILOT_WORKFLOW_ROW_HEIGHT as ROW,
} from "@/constants/autopilot-workflow";
import {
  AUTOPILOT_AUTOMATION_FOCUS_NOTE,
  AUTOPILOT_WORKFLOW_BRANCH_TYPES,
  AUTOPILOT_WORKFLOW_FOCUS_NOTE,
  AUTOPILOT_WORKFLOW_HIDDEN_SETTINGS,
  AUTOPILOT_WORKFLOW_OUTPUT_FIELDS,
  AUTOPILOT_WORKFLOW_REFERENCE_PATTERN,
  AUTOPILOT_WORKFLOW_RULE_OPERATORS,
  AUTOPILOT_WORKFLOW_SCHEDULE_SUNDAY,
  AUTOPILOT_WORKFLOW_UNSCHEDULED_TRIGGER_TITLE,
  AUTOPILOT_WORKFLOW_WEEKDAY_FORMAT,
  AUTOPILOT_WORKFLOWS_PATH,
} from "@/constants/autopilot-workflows";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type {
  AutopilotAutomationFocusSettings,
  AutopilotWorkflowAgentPromptParams,
  AutopilotWorkflowFocus,
  AutopilotWorkflowRunSummary,
  AutopilotWorkflowSchedulePlan,
  AutopilotWorkflowSchedulePlanInput,
} from "@/types/autopilot-workflows";
import type {
  WorkflowRunView,
  WorkflowRunViewNode,
} from "@/types/workflow-engine";

export function describeAutopilotWorkflowSchedule(
  schedule: AutopilotWorkflowSchedule | null
) {
  if (!schedule) {
    return "Only when you run it";
  }
  const time = `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")} UTC`;
  if (schedule.frequency === "weekly") {
    const day = AUTOPILOT_WORKFLOW_WEEKDAY_FORMAT.format(
      AUTOPILOT_WORKFLOW_SCHEDULE_SUNDAY + (schedule.dayOfWeek ?? 1) * DAY_MS
    );
    return `${day}s at ${time}`;
  }
  if (schedule.frequency === "monthly") {
    return `Monthly on day ${schedule.dayOfMonth ?? 1} at ${time}`;
  }
  return `Daily at ${time}`;
}

/** Lays steps out left to right by their distance from the trigger. */
function layoutGraph(graph: WorkflowGraph): WorkflowGraph {
  const depth = new Map(graph.nodes.map((node) => [node.id, 0]));
  // A longest path visits each step at most once, so this many passes settle it.
  for (const _pass of graph.nodes) {
    let changed = false;
    for (const edge of graph.edges) {
      const next = (depth.get(edge.source) ?? 0) + 1;
      if (depth.has(edge.target) && next > (depth.get(edge.target) ?? 0)) {
        depth.set(edge.target, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  const rows = new Map<number, number>();
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const column = depth.get(node.id) ?? 0;
      const row = rows.get(column) ?? 0;
      rows.set(column, row + 1);
      return { ...node, position: { x: column * COLUMN, y: row * ROW } };
    }),
  };
}

/**
 * The same connection twice counts once; the rest are numbered. Ids built
 * from step ids could collide (they hold "_") or pass the 80-character limit.
 */
function numberedEdges(edges: Omit<WorkflowEdge, "id">[]): WorkflowEdge[] {
  const seen = new Set<string>();
  const unique = edges.filter((edge) => {
    const key = JSON.stringify([
      edge.source,
      edge.sourcePort ?? null,
      edge.target,
    ]);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return unique.map((edge, index) => ({ ...edge, id: `e${index + 1}` }));
}

/** Turns the agent's steps and connections into a stored graph. */
export function buildAutopilotWorkflowGraph(input: {
  nodes: WorkflowNode[];
  edges: Omit<WorkflowEdge, "id">[];
}): WorkflowGraph {
  return layoutGraph({
    nodes: input.nodes,
    edges: numberedEdges(input.edges),
  });
}

/** Steps in reading order, each with the branch that leads to it, if any. */
export function orderAutopilotWorkflowSteps(view: WorkflowRunView) {
  const byId = new Map(view.nodes.map((node) => [node.id, node]));
  const position = (node: WorkflowRunViewNode) =>
    node.position ?? { x: 0, y: 0 };
  return view.nodes
    .toSorted(
      (a, b) => position(a).x - position(b).x || position(a).y - position(b).y
    )
    .map((node) => {
      const conditions = view.edges.flatMap((edge) => {
        const source = byId.get(edge.source);
        if (edge.target !== node.id || !edge.sourcePort || !source) {
          return [];
        }
        const port = source.outputs.find((item) => item.id === edge.sourcePort);
        const answer = (port?.label ?? edge.sourcePort).toLowerCase();
        return [`“${source.title}” is ${answer}`];
      });
      return {
        node,
        condition:
          conditions.length > 0 ? `Runs when ${conditions.join(" or ")}` : null,
      };
    });
}

function readString(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field : null;
}

/** What a step produced, as Markdown worth reading, or null when its status says it all. */
export function describeAutopilotWorkflowOutput(output: unknown) {
  const text = readString(output, "text") ?? readString(output, "summary");
  if (text) {
    return text;
  }
  const reason = readString(output, "reason");
  if (reason && typeof output === "object" && output && "answer" in output) {
    return `**${output.answer ? "Yes" : "No"}.** ${reason}`;
  }
  return null;
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

/** Swaps `{{nodes.x.output.y}}` for the step's name, so settings read as text. */
function readableReferences(text: string, titles: Map<string, string>) {
  return text.replace(
    AUTOPILOT_WORKFLOW_REFERENCE_PATTERN,
    (_, _root, nodeId, path: string) => {
      const source = nodeId ? (titles.get(nodeId) ?? nodeId) : "Trigger";
      const field = path.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
      return field ? `‹${source}: ${field}›` : `‹${source}›`;
    }
  );
}

function readableRule(value: string, titles: Map<string, string>) {
  try {
    const rule = JSON.parse(value) as {
      subject?: unknown;
      operator?: string;
      value?: unknown;
    };
    if (typeof rule.operator !== "string") {
      return null;
    }
    const subject = readableReferences(String(rule.subject ?? ""), titles);
    const operator = Object.hasOwn(
      AUTOPILOT_WORKFLOW_RULE_OPERATORS,
      rule.operator
    )
      ? AUTOPILOT_WORKFLOW_RULE_OPERATORS[rule.operator]
      : rule.operator.replaceAll("_", " ");
    return rule.value === undefined
      ? `${subject} ${operator}`
      : `${subject} ${operator} ${JSON.stringify(rule.value)}`;
  } catch {
    return null;
  }
}

/** A step's settings as label and text, without internal ids or raw templates. */
export function readableAutopilotWorkflowSettings(
  settings: { label: string; value: string }[],
  titles: Map<string, string>
) {
  return settings
    .filter((setting) => !AUTOPILOT_WORKFLOW_HIDDEN_SETTINGS.has(setting.label))
    .map((setting) => ({
      label: humanizeKey(setting.label),
      value:
        (setting.label === "rule"
          ? readableRule(setting.value, titles)
          : null) ?? readableReferences(setting.value, titles),
    }));
}

/** Cuts text to a length, ending with an ellipsis when it had to. */
export function truncateText(text: string, limit: number) {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

/**
 * An agent step's prompt. When earlier output was filled into the text, the
 * model also gets the original, so it can tell the user's instructions from
 * the filled-in data, which may come from web pages or AI answers.
 */
export function autopilotWorkflowAgentPrompt(
  params: AutopilotWorkflowAgentPromptParams
) {
  const { title, template, resolved } = params;
  if (typeof template !== "string" || template === resolved) {
    return `${title}\n\n${resolved}`;
  }
  return [
    title,
    `Instructions:\n${template}`,
    "The same instructions with the {{…}} placeholders filled in from earlier steps:",
    `BEGIN UNTRUSTED\n${resolved}\nEND UNTRUSTED`,
  ].join("\n\n");
}

/**
 * Mistakes the graph validator can't see: reading an output field a step
 * doesn't have, and a branch step with nothing after it. Each issue says how
 * to fix it, for the agent that saves the workflow.
 */
export function findAutopilotWorkflowMistakes(input: {
  nodes: Pick<WorkflowNode, "id" | "type" | "title" | "config">[];
  edges: Pick<WorkflowEdge, "source">[];
}) {
  const byId = new Map(input.nodes.map((node) => [node.id, node]));
  const issues: string[] = [];
  for (const node of input.nodes) {
    const texts = Object.values(node.config ?? {}).flatMap((value) =>
      typeof value === "string" ? [value] : [JSON.stringify(value) ?? ""]
    );
    for (const text of texts) {
      for (const match of text.matchAll(AUTOPILOT_WORKFLOW_REFERENCE_PATTERN)) {
        const [, , sourceId, path] = match;
        const source = sourceId
          ? byId.get(sourceId)
          : { id: "trigger", type: "core.trigger", title: "Trigger" };
        const field = path?.split(/[.[]/)[0];
        const fields = source
          ? AUTOPILOT_WORKFLOW_OUTPUT_FIELDS[source.type]
          : undefined;
        if (source && field && fields && !fields.includes(field)) {
          issues.push(
            `"${node.title}" reads "${field}" from "${source.title}", which only outputs ${fields.join(", ")}.`
          );
        }
      }
    }
    if (
      AUTOPILOT_WORKFLOW_BRANCH_TYPES.has(node.type) &&
      !input.edges.some((edge) => edge.source === node.id)
    ) {
      issues.push(
        `"${node.title}" decides between branches, but no step follows it. Connect the branch that should act.`
      );
    }
  }
  return [...new Set(issues)];
}

/** The trigger is named after when it runs, so its title can't contradict it. */
export function triggerTitle(schedule: AutopilotWorkflowSchedule | null) {
  return schedule
    ? describeAutopilotWorkflowSchedule(schedule)
    : AUTOPILOT_WORKFLOW_UNSCHEDULED_TRIGGER_TITLE;
}

/**
 * The workflow whose page the user is on, for the agent: what it does, its
 * steps and how its recent runs went, so "this workflow" needs no lookup.
 */
export function describeFocusedAutopilotWorkflow({
  workflow,
  definition,
  path,
}: AutopilotWorkflowFocus) {
  const summary = {
    workflowId: workflow.id,
    name: workflow.name,
    description: workflow.description,
    path,
    on: workflow.enabled,
    runsAt: describeAutopilotWorkflowSchedule(definition.schedule),
    // As saved, so a change sends them back with only its edits.
    schedule: definition.schedule,
    nodes: definition.graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      description: node.description,
      config: node.config,
      onError: node.onError,
    })),
    edges: definition.graph.edges.map(({ source, sourcePort, target }) => ({
      source,
      sourcePort,
      target,
    })),
    problems: workflow.issues.map((issue) => issue.message),
    runs: workflow.runCount,
    recentRuns: workflow.runs.slice(0, 3).map((run) => ({
      runId: run.id,
      status: run.status,
      startedAt: new Date(run.createdAt).toISOString(),
      error: run.errorMessage,
    })),
  };
  return `${AUTOPILOT_WORKFLOW_FOCUS_NOTE}\n${JSON.stringify(summary)}`;
}

/** The workflow whose page a path points at, such as /acme/autopilot/workflows/abc. */
export function autopilotWorkflowIdFromPath(pathname: string) {
  const [, , section, sub, id] = pathname.split("/");
  return `/${section}` === AUTOPILOT_NAV_LINK &&
    `/${sub}` === AUTOPILOT_WORKFLOWS_PATH &&
    id
    ? id
    : null;
}

/** Whether a run had the steps the workflow has now, by id, kind and title. */
export function hasSameAutopilotWorkflowSteps(
  a: Pick<WorkflowRunView, "nodes">,
  b: Pick<WorkflowRunView, "nodes">
) {
  const shape = (view: Pick<WorkflowRunView, "nodes">) =>
    view.nodes
      .map((node) => `${node.id}|${node.type}|${node.title}`)
      .toSorted()
      .join("\n");
  return shape(a) === shape(b);
}

/** A built-in automation the user is looking at, for the agent. */
export function describeFocusedAutopilotAutomation(
  kind: AutopilotAutomationKind,
  settings: AutopilotAutomationFocusSettings | null
) {
  const automation = AUTOPILOT_AUTOMATIONS[kind];
  const summary = {
    automation: automation.name,
    whatItDoes: automation.description,
    reads: automation.source,
    produces: automation.output,
    alsoRuns: automation.alsoOn,
    on: Boolean(settings?.enabled && settings.jobs[kind] !== false),
    autopilotOn: Boolean(settings?.enabled),
    runsDaily: settings
      ? `${String(settings.briefHour).padStart(2, "0")}:00 ${settings.timezone}`
      : null,
  };
  return `${AUTOPILOT_AUTOMATION_FOCUS_NOTE}\n${JSON.stringify(summary)}`;
}

/** The built-in automation whose page a path points at, such as /acme/autopilot/releases. */
export function autopilotAutomationKindFromPath(pathname: string) {
  const [, , section, slug, rest] = pathname.split("/");
  if (`/${section}` !== AUTOPILOT_NAV_LINK || !slug || rest) {
    return null;
  }
  return (
    AUTOPILOT_AUTOMATION_KINDS.find(
      (kind) => AUTOPILOT_AUTOMATION_SLUGS[kind] === slug
    ) ?? null
  );
}

/** Whether a workflow run is still going. */
export function isAutopilotWorkflowRunActive(
  run: Pick<AutopilotWorkflowRunSummary, "status">
) {
  return run.status === "queued" || run.status === "running";
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortedKeys(item)])
    );
  }
  return value;
}

/**
 * A step setting as text. Objects get their keys in a fixed order, as the
 * database may store them in another one than the agent wrote.
 */
export function autopilotWorkflowSettingValue(value: unknown): string {
  return typeof value === "string"
    ? value
    : (JSON.stringify(sortedKeys(value)) ?? "");
}

/**
 * What syncing a workflow's schedule does: update its schedule, make a new
 * one, or remove it. A new schedule always gets a fresh id, never one used
 * before, so a delete of an old schedule that lands late can't hit it.
 */
export function planAutopilotWorkflowSchedule({
  workflowId,
  storedScheduleId,
  cron,
}: AutopilotWorkflowSchedulePlanInput): AutopilotWorkflowSchedulePlan {
  if (cron) {
    return {
      action: "create",
      cron,
      scheduleId:
        storedScheduleId ?? `autopilot-workflow-${workflowId}-${nanoid(8)}`,
    };
  }
  return storedScheduleId
    ? { action: "remove", scheduleId: storedScheduleId }
    : { action: "none" };
}
