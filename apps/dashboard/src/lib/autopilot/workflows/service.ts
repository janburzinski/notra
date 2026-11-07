import {
  buildCronExpression,
  createQstashRouteSchedule,
  deleteQstashSchedule,
} from "@notra/ai/qstash/triggers";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  autopilotWorkflows,
  slackIntegrations,
  workflowRuns,
} from "@notra/db/schema";
import type { AutopilotWorkflowSchedule } from "@notra/db/types/workflows";
import { validateWorkflowBundle } from "@notra/workflows/runtime/bundle";
import { getConnectablePorts } from "@notra/workflows/runtime/ports";
import { inspectWorkflowGraph } from "@notra/workflows/runtime/validate";
import type { WorkflowBlock } from "@notra/workflows/types/blocks";
import type {
  WorkflowDefinition,
  WorkflowNode,
} from "@notra/workflows/types/graph";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import * as z from "zod";

import {
  AUTOPILOT_WORKFLOW_BLOCK_TYPES,
  AUTOPILOT_WORKFLOW_CUSTOM_BLOCK_TYPES,
  AUTOPILOT_WORKFLOW_KEY_PREFIX,
  AUTOPILOT_WORKFLOW_LIMIT,
  AUTOPILOT_WORKFLOW_QSTASH_TIMEOUT_MS,
  AUTOPILOT_WORKFLOW_RUN_PATH,
  AUTOPILOT_WORKFLOW_RUNS_LIMIT,
  AUTOPILOT_WORKFLOW_SCHEDULE_FAILED,
  AUTOPILOT_WORKFLOW_SCHEDULE_LOCK_TIMEOUT_MS,
  AUTOPILOT_WORKFLOW_SLACK_MISSING,
} from "@/constants/autopilot-workflows";
import { workflowBlockRegistry } from "@/lib/workflow-engine/blocks";
import { getWorkflowRunViews } from "@/lib/workflow-engine/run-view";
import { startWorkflowRun } from "@/lib/workflow-engine/start";
import type { saveAutopilotWorkflowInputSchema } from "@/schemas/autopilot-workflows";
import type {
  AutopilotWorkflowDetail,
  AutopilotWorkflowRow,
  AutopilotWorkflowTransaction,
  AutopilotWorkflowRunSummary,
  AutopilotWorkflowSummary,
  SaveAutopilotWorkflowResult,
} from "@/types/autopilot-workflows";
import type { WorkflowRunView } from "@/types/workflow-engine";
import {
  autopilotWorkflowSettingValue,
  planAutopilotWorkflowSchedule,
  buildAutopilotWorkflowGraph,
  findAutopilotWorkflowMistakes,
  triggerTitle,
} from "@/utils/autopilot-workflows";

function autopilotWorkflowKey(workflowId: string) {
  return `${AUTOPILOT_WORKFLOW_KEY_PREFIX}${workflowId}`;
}

function customBlocks(): Record<string, WorkflowBlock> {
  return Object.fromEntries(
    Object.entries(workflowBlockRegistry.byType()).filter(([type]) =>
      AUTOPILOT_WORKFLOW_CUSTOM_BLOCK_TYPES.has(type)
    )
  );
}

function toDefinition(
  row: Pick<AutopilotWorkflowRow, "id" | "name" | "graph">
) {
  const key = autopilotWorkflowKey(row.id);
  const definition: WorkflowDefinition = {
    key,
    title: row.name,
    startedBy: "both",
    graph: row.graph,
  };
  return { key, definitions: { [key]: definition } };
}

function validateGraph(
  row: Pick<AutopilotWorkflowRow, "id" | "name" | "graph">
) {
  const { key, definitions } = toDefinition(row);
  return validateWorkflowBundle(key, { definitions, blocks: customBlocks() });
}

function toSummary(row: AutopilotWorkflowRow): AutopilotWorkflowSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    schedule: row.schedule,
    lastRunAt: row.lastRunAt,
    updatedAt: row.updatedAt,
    stepCount: row.graph.nodes.length,
  };
}

function configSettings(config: Record<string, unknown> | undefined) {
  return Object.entries(config ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => ({
      label,
      value: autopilotWorkflowSettingValue(value),
    }));
}

function withRunSettings(
  nodes: WorkflowRunView["nodes"],
  graphNodes: WorkflowNode[]
) {
  const configs = new Map(graphNodes.map((node) => [node.id, node.config]));
  return nodes.map((node) => ({
    ...node,
    settings: configSettings(configs.get(node.id)),
  }));
}

function previewView(row: AutopilotWorkflowRow): WorkflowRunView {
  const blocks = customBlocks();
  const compiled = inspectWorkflowGraph(row.graph, { blocks }).graph;
  const nodes: WorkflowNode[] = compiled?.nodes ?? row.graph.nodes;
  return {
    id: row.id,
    title: row.name,
    parentRunId: null,
    startedAt: null,
    nodes: nodes.map(({ config, ...node }) => {
      const block = Object.hasOwn(blocks, node.type)
        ? blocks[node.type]
        : undefined;
      const outputs =
        "outputs" in node && Array.isArray(node.outputs)
          ? node.outputs
          : undefined;
      return {
        ...node,
        logo: block?.logo ?? null,
        outputs: getConnectablePorts({ outputs, onError: node.onError }),
        status: null,
        port: null,
        output: null,
        error: null,
        reason: null,
        startedAt: null,
        finishedAt: null,
        steps: (block?.steps ?? []).map((step) => ({
          id: step.id,
          title: step.title,
          status: null,
          attempts: 0,
          error: null,
          startedAt: null,
          finishedAt: null,
        })),
        settings: configSettings(config),
      };
    }),
    edges: row.graph.edges.map((edge) => ({ ...edge, taken: null })),
  };
}

/** Every write names the workspace too, so an id alone never crosses it. */
function byWorkflow(row: Pick<AutopilotWorkflowRow, "id" | "organizationId">) {
  return and(
    eq(autopilotWorkflows.organizationId, row.organizationId),
    eq(autopilotWorkflows.id, row.id)
  );
}

async function getRow(organizationId: string, workflowId: string) {
  const [row] = await db
    .select()
    .from(autopilotWorkflows)
    .where(
      and(
        eq(autopilotWorkflows.organizationId, organizationId),
        eq(autopilotWorkflows.id, workflowId)
      )
    )
    .limit(1);
  return row ?? null;
}

/** Fails a QStash call that takes too long, so it can't hold the lock. */
async function withinQstashTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("QStash didn't answer in time")),
          AUTOPILOT_WORKFLOW_QSTASH_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function isMissingSchedule(error: unknown) {
  return (
    error instanceof Error &&
    "status" in error &&
    (error as { status?: number }).status === 404
  );
}

/** Deletes a QStash schedule; one that's already gone counts as deleted. */
async function removeQstashSchedule(scheduleId: string) {
  await withinQstashTimeout(deleteQstashSchedule(scheduleId)).catch(
    (error: unknown) => {
      if (!isMissingSchedule(error)) {
        throw error;
      }
    }
  );
}

/**
 * Runs schedule work with the workflow's row locked and read fresh, so
 * changes made at the same time can't undo each other. A change waiting for
 * the lock gives up after a while rather than holding a connection.
 */
function withScheduleLock<T>(
  workflowId: string,
  work: (
    tx: AutopilotWorkflowTransaction,
    row: AutopilotWorkflowRow | undefined
  ) => Promise<T>
) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(
        `set local lock_timeout = ${AUTOPILOT_WORKFLOW_SCHEDULE_LOCK_TIMEOUT_MS}`
      )
    );
    const [row] = await tx
      .select()
      .from(autopilotWorkflows)
      .where(eq(autopilotWorkflows.id, workflowId))
      .for("update");
    return work(tx, row);
  });
}

/**
 * Points the QStash schedule at the workflow, or removes it, and says whether
 * the workflow's schedule is now as saved.
 *
 * Only the stored id is the workflow's schedule, and an id is never used
 * twice. Removing clears it even when QStash fails or times out, so the next
 * enable makes a fresh one that a delete landing late can't touch. Any
 * schedule left behind, by that delete or by a create that timed out, isn't
 * the workflow's, and its first delivery removes it
 * (`dropStaleAutopilotSchedule`).
 */
async function syncSchedule(
  workflowId: string,
  options: { remove?: boolean } = {}
): Promise<boolean> {
  try {
    await withScheduleLock(workflowId, async (tx, row) => {
      if (!row) {
        return;
      }
      const plan = planAutopilotWorkflowSchedule({
        workflowId: row.id,
        storedScheduleId: row.qstashScheduleId,
        cron:
          !options.remove && row.enabled && row.schedule
            ? buildCronExpression(row.schedule)
            : null,
      });
      if (plan.action === "create") {
        const scheduleId = await withinQstashTimeout(
          createQstashRouteSchedule({
            path: AUTOPILOT_WORKFLOW_RUN_PATH,
            cron: plan.cron,
            body: { workflowId: row.id },
            scheduleId: plan.scheduleId,
          })
        );
        if (scheduleId !== row.qstashScheduleId) {
          await tx
            .update(autopilotWorkflows)
            .set({ qstashScheduleId: scheduleId })
            .where(byWorkflow(row));
        }
        return;
      }
      if (plan.action === "remove") {
        await tx
          .update(autopilotWorkflows)
          .set({ qstashScheduleId: null })
          .where(byWorkflow(row));
        await removeQstashSchedule(plan.scheduleId).catch((error: unknown) => {
          // Cleared all the same: it's no longer the workflow's, and goes
          // on its next delivery.
          logError(
            "[Autopilot workflow] Removing a schedule failed; it goes on its next delivery",
            error,
            { workflowId: row.id, scheduleId: plan.scheduleId }
          );
        });
      }
    });
    return true;
  } catch (error) {
    logError("[Autopilot workflow] Schedule sync failed", error, {
      workflowId,
    });
    return false;
  }
}

/**
 * Removes a schedule that delivered for a workflow it no longer belongs to,
 * such as one made by a create that timed out, or one left by a deleted
 * workflow. It checks with the row locked, so a schedule that a running sync
 * is just storing counts as the workflow's. Returns whether it was stale.
 */
export async function dropStaleAutopilotSchedule(
  workflowId: string,
  scheduleId: string
) {
  try {
    return await withScheduleLock(workflowId, async (_tx, row) => {
      if (row?.qstashScheduleId === scheduleId) {
        return false;
      }
      await removeQstashSchedule(scheduleId);
      return true;
    });
  } catch (error) {
    logError("[Autopilot workflow] Removing a stale schedule failed", error, {
      workflowId,
      scheduleId,
    });
    return true;
  }
}

export async function listAutopilotWorkflows(
  organizationId: string
): Promise<AutopilotWorkflowSummary[]> {
  const rows = await db
    .select()
    .from(autopilotWorkflows)
    .where(eq(autopilotWorkflows.organizationId, organizationId))
    .orderBy(desc(autopilotWorkflows.updatedAt))
    .limit(AUTOPILOT_WORKFLOW_LIMIT);
  return rows.map(toSummary);
}

function runsOf(organizationId: string, workflowId: string) {
  return and(
    eq(workflowRuns.organizationId, organizationId),
    eq(workflowRuns.workflowKey, autopilotWorkflowKey(workflowId)),
    isNull(workflowRuns.parentRunId)
  );
}

async function countRuns(organizationId: string, workflowId: string) {
  const [total] = await db
    .select({ value: count() })
    .from(workflowRuns)
    .where(runsOf(organizationId, workflowId));
  return total?.value ?? 0;
}

async function listRuns(
  organizationId: string,
  workflowId: string
): Promise<AutopilotWorkflowRunSummary[]> {
  return await db
    .select({
      id: workflowRuns.id,
      status: workflowRuns.status,
      trigger: workflowRuns.trigger,
      errorMessage: workflowRuns.errorMessage,
      startedAt: workflowRuns.startedAt,
      finishedAt: workflowRuns.finishedAt,
      createdAt: workflowRuns.createdAt,
    })
    .from(workflowRuns)
    .where(runsOf(organizationId, workflowId))
    .orderBy(desc(workflowRuns.createdAt))
    .limit(AUTOPILOT_WORKFLOW_RUNS_LIMIT);
}

export async function getAutopilotWorkflow(
  organizationId: string,
  workflowId: string
): Promise<AutopilotWorkflowDetail | null> {
  const row = await getRow(organizationId, workflowId);
  if (!row) {
    return null;
  }
  const [runs, runCount] = await Promise.all([
    listRuns(organizationId, workflowId),
    countRuns(organizationId, workflowId),
  ]);
  return {
    ...toSummary(row),
    view: previewView(row),
    issues: validateGraph(row),
    runs,
    runCount,
  };
}

/** The workflow as saved, so the agent can change it without losing settings. */
export async function getAutopilotWorkflowDefinition(
  organizationId: string,
  workflowId: string
) {
  const row = await getRow(organizationId, workflowId);
  return row ? { graph: row.graph, schedule: row.schedule } : null;
}

/**
 * Everything a save checks before it writes: the workflow to update, the
 * workspace's limit and the steps themselves.
 */
async function prepareSave(
  organizationId: string,
  input: z.infer<typeof saveAutopilotWorkflowInputSchema>
) {
  const existing = input.workflowId
    ? await getRow(organizationId, input.workflowId)
    : null;
  if (input.workflowId && !existing) {
    return {
      ok: false as const,
      issues: [`No workflow "${input.workflowId}" exists`],
    };
  }
  if (!existing) {
    const [total] = await db
      .select({ value: count() })
      .from(autopilotWorkflows)
      .where(eq(autopilotWorkflows.organizationId, organizationId));
    if ((total?.value ?? 0) >= AUTOPILOT_WORKFLOW_LIMIT) {
      return {
        ok: false as const,
        issues: [
          `This workspace already has ${AUTOPILOT_WORKFLOW_LIMIT} workflows. Update or delete one first.`,
        ],
      };
    }
  }

  const id = existing?.id ?? nanoid(16);
  const schedule: AutopilotWorkflowSchedule | null =
    input.schedule === undefined
      ? (existing?.schedule ?? null)
      : input.schedule;
  const mistakes = findAutopilotWorkflowMistakes(input);
  if (mistakes.length > 0) {
    return { ok: false as const, issues: mistakes };
  }
  const graph = buildAutopilotWorkflowGraph({
    ...input,
    nodes: input.nodes.map((node) =>
      node.type === "core.trigger"
        ? { ...node, title: triggerTitle(schedule) }
        : node
    ),
  });
  const issues = validateGraph({ id, name: input.name, graph });
  if (issues.length > 0) {
    return {
      ok: false as const,
      issues: issues.map((issue) => issue.message),
    };
  }
  return { ok: true as const, existing, id, schedule, graph };
}

/** Why a save would be turned down, without saving; empty when it would go through. */
export async function findAutopilotWorkflowSaveIssues(
  organizationId: string,
  input: z.infer<typeof saveAutopilotWorkflowInputSchema>
) {
  const prepared = await prepareSave(organizationId, input);
  return prepared.ok ? [] : prepared.issues;
}

export async function saveAutopilotWorkflow(params: {
  organizationId: string;
  userId?: string;
  input: z.infer<typeof saveAutopilotWorkflowInputSchema>;
}): Promise<SaveAutopilotWorkflowResult> {
  const { organizationId, input } = params;
  const prepared = await prepareSave(organizationId, input);
  if (!prepared.ok) {
    return { ok: false, issues: prepared.issues };
  }
  const { existing, id, schedule, graph } = prepared;
  const values = {
    name: input.name,
    description: input.description ?? existing?.description ?? null,
    graph,
    schedule,
    enabled: input.enabled ?? (existing ? existing.enabled : schedule !== null),
  };
  const [row] = existing
    ? await db
        .update(autopilotWorkflows)
        .set(values)
        .where(byWorkflow({ id, organizationId }))
        .returning()
    : await db
        .insert(autopilotWorkflows)
        .values({
          id,
          organizationId,
          createdByUserId: params.userId ?? null,
          ...values,
        })
        .returning();
  if (!row) {
    throw new Error("The workflow wasn't saved");
  }
  const postsToSlack = graph.nodes.some(
    (node) => node.type === AUTOPILOT_WORKFLOW_BLOCK_TYPES.postToSlack
  );
  const [scheduled, slackReady] = await Promise.all([
    syncSchedule(row.id),
    postsToSlack ? hasSlackChannel(organizationId) : Promise.resolve(true),
  ]);
  const warning = [
    scheduled ? null : AUTOPILOT_WORKFLOW_SCHEDULE_FAILED,
    slackReady ? null : AUTOPILOT_WORKFLOW_SLACK_MISSING,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    ok: true,
    workflowId: id,
    created: !existing,
    ...(warning ? { warning } : {}),
  };
}

export async function setAutopilotWorkflowEnabled(
  organizationId: string,
  workflowId: string,
  enabled: boolean
) {
  const [row] = await db
    .update(autopilotWorkflows)
    .set({ enabled })
    .where(
      and(
        eq(autopilotWorkflows.organizationId, organizationId),
        eq(autopilotWorkflows.id, workflowId)
      )
    )
    .returning();
  if (!row) {
    return null;
  }
  const scheduled = await syncSchedule(row.id);
  return { warning: scheduled ? null : AUTOPILOT_WORKFLOW_SCHEDULE_FAILED };
}

/**
 * Deletes a workflow once its schedule is cleared. A schedule QStash didn't
 * confirm removing goes on its next delivery; only when the schedule can't
 * be cleared at all does the workflow stay, so deleting can be tried again.
 */
export async function deleteAutopilotWorkflow(
  organizationId: string,
  workflowId: string
): Promise<"deleted" | "missing" | "schedule-failed"> {
  const row = await getRow(organizationId, workflowId);
  if (!row) {
    return "missing";
  }
  if (!(await syncSchedule(row.id, { remove: true }))) {
    return "schedule-failed";
  }
  await db.delete(autopilotWorkflows).where(byWorkflow(row));
  return "deleted";
}

export async function runAutopilotWorkflow(params: {
  organizationId: string;
  workflowId: string;
  trigger: "manual" | "schedule";
  runId?: string;
}) {
  const row = await getRow(params.organizationId, params.workflowId);
  if (!row) {
    return null;
  }
  const { key, definitions } = toDefinition(row);
  const runId = await startWorkflowRun({
    runId: params.runId ?? nanoid(),
    organizationId: params.organizationId,
    workflowKey: key,
    trigger: params.trigger,
    input: { startedAt: new Date().toISOString(), trigger: params.trigger },
    definitions,
    blocks: customBlocks(),
  });
  await db
    .update(autopilotWorkflows)
    .set({ lastRunAt: new Date(), updatedAt: row.updatedAt })
    .where(byWorkflow(row));
  return runId;
}

/**
 * Whether any of these runs launched. A launch that failed leaves a failed run
 * that never started, so a retry of the same delivery may try again.
 */
export async function anyAutopilotWorkflowRunLaunched(runIds: string[]) {
  if (runIds.length === 0) {
    return false;
  }
  const [row] = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(
      and(
        inArray(workflowRuns.id, runIds),
        or(ne(workflowRuns.status, "failed"), isNotNull(workflowRuns.startedAt))
      )
    )
    .limit(1);
  return Boolean(row);
}

/** Finds the workflow a QStash delivery is for, whatever workspace it is in. */
export async function findScheduledAutopilotWorkflow(workflowId: string) {
  const [row] = await db
    .select({
      organizationId: autopilotWorkflows.organizationId,
      enabled: autopilotWorkflows.enabled,
      qstashScheduleId: autopilotWorkflows.qstashScheduleId,
    })
    .from(autopilotWorkflows)
    .where(eq(autopilotWorkflows.id, workflowId))
    .limit(1);
  return row ?? null;
}

export async function getAutopilotWorkflowRun(
  organizationId: string,
  runId: string
) {
  const views = await getWorkflowRunViews(organizationId, runId);
  const [root] = views;
  if (!root) {
    return null;
  }
  const [run] = await db
    .select({
      status: workflowRuns.status,
      workflowKey: workflowRuns.workflowKey,
      errorMessage: workflowRuns.errorMessage,
      graph: workflowRuns.graph,
    })
    .from(workflowRuns)
    .where(eq(workflowRuns.id, root.id))
    .limit(1);
  if (!run?.workflowKey.startsWith(AUTOPILOT_WORKFLOW_KEY_PREFIX)) {
    return null;
  }
  const workflow = await getRow(
    organizationId,
    run.workflowKey.slice(AUTOPILOT_WORKFLOW_KEY_PREFIX.length)
  );
  return {
    status: run.status,
    error: run.errorMessage,
    views: views.map((view) =>
      view.id === root.id
        ? {
            ...view,
            title: workflow?.name ?? view.title,
            // The settings this run used, not today's: a step changed from
            // 7 to 30 days still shows 7 next to the results it made.
            nodes: withRunSettings(view.nodes, run.graph.nodes),
          }
        : view
    ),
  };
}

/** Whether a Slack step has somewhere to post: an enabled Slack with a channel. */
async function hasSlackChannel(organizationId: string) {
  const [row] = await db
    .select({ id: slackIntegrations.id })
    .from(slackIntegrations)
    .where(
      and(
        eq(slackIntegrations.organizationId, organizationId),
        eq(slackIntegrations.enabled, true),
        isNotNull(slackIntegrations.notificationChannelId)
      )
    )
    .limit(1);
  return Boolean(row);
}

/** The steps a workflow can use, and what this workspace has set up for them. */
export async function describeAutopilotWorkflowSteps(organizationId: string) {
  const slackConnected = await hasSlackChannel(organizationId);
  return {
    steps: listWorkflowSteps(),
    workspace: {
      slack: slackConnected
        ? "Connected: Slack steps post to the channel the workspace picked."
        : AUTOPILOT_WORKFLOW_SLACK_MISSING,
    },
  };
}

function listWorkflowSteps() {
  const core = [
    {
      type: "core.trigger",
      title: "Trigger",
      description:
        "Every workflow starts with exactly one. Nothing leads into it. Output: startedAt, trigger (manual or schedule).",
      config: null,
    },
    {
      type: "core.if",
      title: "If",
      description:
        'Follows the "true" or "false" branch. config.rule is { subject, operator, value }, e.g. { "subject": "{{nodes.geo.output.behind}}", "operator": "equals", "value": true }. Operators: equals, not_equals, gt, gte, lt, lte, contains, exists, in.',
      config: null,
    },
    {
      type: "core.switch",
      title: "Switch",
      description:
        'config.cases is a list of { id, label?, rule }; the first matching case\'s id is the branch, otherwise "otherwise".',
      config: null,
    },
  ];
  const custom = Object.values(customBlocks()).map((block) => ({
    type: block.type,
    title: block.title,
    description: block.description ?? "",
    branches: block.outputs?.map((port) => port.id) ?? null,
    config: z.toJSONSchema(block.configSchema, { io: "input" }),
  }));
  return [...core, ...custom];
}

export async function getAutopilotWorkflowRunViews(
  organizationId: string,
  runId: string
) {
  const result = await getAutopilotWorkflowRun(organizationId, runId);
  return result?.views ?? [];
}
