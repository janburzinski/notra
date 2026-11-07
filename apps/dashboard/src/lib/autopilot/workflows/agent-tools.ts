import type { ChatSurface } from "@notra/ai/types/chat";
import type { ToolSet } from "@notra/ai/types/orchestration";
import { toolDescription } from "@notra/ai/utils/description";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import { autopilotSettings, members, organizations } from "@notra/db/schema";
import { type Tool, tool } from "ai";
import { and, eq } from "drizzle-orm";

import { AGENT_QUESTION_TOOL_NAME } from "@/constants/agent-questions";
import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import {
  AUTOPILOT_WORKFLOW_AGENT_DESCRIPTION,
  AUTOPILOT_WORKFLOW_QUESTION_NOTE,
  AUTOPILOT_WORKFLOW_READ_ONLY_NOTE,
  AUTOPILOT_WORKFLOW_RUN_TOOL_NAME,
  AUTOPILOT_WORKFLOW_SAVE_TOOL_NAME,
  AUTOPILOT_WORKFLOWS_PATH,
} from "@/constants/autopilot-workflows";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import {
  describeAutopilotWorkflowSteps,
  getAutopilotWorkflow,
  getAutopilotWorkflowDefinition,
  findAutopilotWorkflowSaveIssues,
  getAutopilotWorkflowRun,
  listAutopilotWorkflows,
  runAutopilotWorkflow,
  saveAutopilotWorkflow,
} from "@/lib/autopilot/workflows/service";
import {
  agentQuestionInputSchema,
  agentQuestionOutputSchema,
} from "@/schemas/agent-questions";
import {
  listAutopilotWorkflowsInputSchema,
  listAutopilotWorkflowStepsInputSchema,
  saveAutopilotWorkflowInputSchema,
  workflowIdToolInputSchema,
  workflowRunToolInputSchema,
} from "@/schemas/autopilot-workflows";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import {
  formatAgentAnswers,
  readAgentAnswers,
  readAgentQuestions,
} from "@/utils/agent-questions";
import { canManageAutopilot } from "@/utils/autopilot-permissions";
import {
  describeFocusedAutopilotAutomation,
  describeFocusedAutopilotWorkflow,
} from "@/utils/autopilot-workflows";

/** Where the workspace's workflow pages live, so links never get guessed. */
async function workflowsPath(organizationId: string) {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { slug: true },
  });
  return organization
    ? `/${organization.slug}${AUTOPILOT_NAV_LINK}${AUTOPILOT_WORKFLOWS_PATH}`
    : null;
}

async function workflowPath(organizationId: string, workflowId: string) {
  const base = await workflowsPath(organizationId);
  return base ? `${base}/${workflowId}` : null;
}

/** What's on screen: one of this workspace's workflows, or a built-in automation. */
function focusNote(
  organizationId: string,
  focus: { focusWorkflowId?: string; focusAutomation?: string }
) {
  if (focus.focusWorkflowId) {
    return focusedWorkflowNote(organizationId, focus.focusWorkflowId);
  }
  const kind = AUTOPILOT_AUTOMATION_KINDS.find(
    (item) => item === focus.focusAutomation
  );
  return kind ? focusedAutomationNote(organizationId, kind) : null;
}

async function focusedAutomationNote(
  organizationId: string,
  kind: AutopilotAutomationKind
) {
  const settings = await db.query.autopilotSettings.findFirst({
    where: eq(autopilotSettings.organizationId, organizationId),
    columns: { enabled: true, jobs: true, briefHour: true, timezone: true },
  });
  return describeFocusedAutopilotAutomation(kind, settings ?? null);
}

/** The note on the workflow on screen; only one of this workspace's. */
async function focusedWorkflowNote(organizationId: string, workflowId: string) {
  const [workflow, definition, path] = await Promise.all([
    getAutopilotWorkflow(organizationId, workflowId),
    getAutopilotWorkflowDefinition(organizationId, workflowId),
    workflowPath(organizationId, workflowId),
  ]);
  return workflow && definition
    ? describeFocusedAutopilotWorkflow({ workflow, definition, path })
    : null;
}

async function canManage(organizationId: string, userId?: string) {
  if (!userId) {
    return false;
  }
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, organizationId),
      eq(members.userId, userId)
    ),
    columns: { role: true },
  });
  return membership ? canManageAutopilot(membership.role) : false;
}

function readTools(organizationId: string): Record<string, Tool> {
  return {
    listAutopilotWorkflowSteps: tool({
      description: toolDescription({
        toolName: "listAutopilotWorkflowSteps",
        intro:
          "Lists the steps an Autopilot workflow can use: their type, what they output, the branches they follow and their config JSON schema, plus what this workspace has connected for them, such as Slack.",
        whenToUse: "Before building or changing an Autopilot workflow.",
      }),
      inputSchema: listAutopilotWorkflowStepsInputSchema,
      execute: () => describeAutopilotWorkflowSteps(organizationId),
    }),
    listAutopilotWorkflows: tool({
      description: toolDescription({
        toolName: "listAutopilotWorkflows",
        intro:
          "Lists the Autopilot workflows built for this workspace with their schedule, when they last ran and the path to link each one.",
        whenToUse:
          "Before building one, so you update a matching workflow instead of adding a duplicate, or when the user asks what Autopilot runs.",
      }),
      inputSchema: listAutopilotWorkflowsInputSchema,
      execute: async () => {
        const [workflows, base] = await Promise.all([
          listAutopilotWorkflows(organizationId),
          workflowsPath(organizationId),
        ]);
        return {
          workflows: workflows.map((workflow) => ({
            ...workflow,
            path: base ? `${base}/${workflow.id}` : null,
          })),
        };
      },
    }),
    getAutopilotWorkflow: tool({
      description: toolDescription({
        toolName: "getAutopilotWorkflow",
        intro:
          "Returns one Autopilot workflow's steps with their exact config, its connections and schedule as saved, any problems that stop it from running, its recent runs and the path to link it.",
        whenToUse: "Before changing a workflow or explaining what it does.",
      }),
      inputSchema: workflowIdToolInputSchema,
      execute: async ({ workflowId }) => {
        const [workflow, definition, path] = await Promise.all([
          getAutopilotWorkflow(organizationId, workflowId),
          getAutopilotWorkflowDefinition(organizationId, workflowId),
          workflowPath(organizationId, workflowId),
        ]);
        if (!(workflow && definition)) {
          return { error: `No Autopilot workflow "${workflowId}" exists` };
        }
        const { view: _view, ...rest } = workflow;
        // As saved, so a change can send them back with only its edits.
        return {
          ...rest,
          path,
          schedule: definition.schedule,
          nodes: definition.graph.nodes.map((node) => ({
            id: node.id,
            type: node.type,
            title: node.title,
            description: node.description,
            config: node.config,
            onError: node.onError,
          })),
          edges: definition.graph.edges.map(
            ({ source, sourcePort, target }) => ({
              source,
              sourcePort,
              target,
            })
          ),
          issues: workflow.issues.map((issue) => issue.message),
        };
      },
    }),
    getAutopilotWorkflowRun: tool({
      description: toolDescription({
        toolName: "getAutopilotWorkflowRun",
        intro:
          "Returns an Autopilot workflow run's status and each step's status, output and error.",
        whenToUse:
          "After runAutopilotWorkflow, or when the user asks how a run went.",
        usageNotes:
          "A queued or running status means it isn't done; tell the user it is still running rather than waiting.",
      }),
      inputSchema: workflowRunToolInputSchema,
      execute: async ({ runId }) => {
        const run = await getAutopilotWorkflowRun(organizationId, runId);
        if (!run) {
          return { error: `No Autopilot workflow run "${runId}" exists` };
        }
        return {
          status: run.status,
          error: run.error,
          steps: run.views.flatMap((view) =>
            view.nodes.map((node) => ({
              id: node.id,
              title: node.title,
              status: node.status,
              output: node.output,
              error: node.error ?? node.reason,
            }))
          ),
        };
      },
    }),
  };
}

function manageTools(organizationId: string, userId?: string) {
  return {
    [AUTOPILOT_WORKFLOW_SAVE_TOOL_NAME]: tool({
      description: toolDescription({
        toolName: "saveAutopilotWorkflow",
        intro:
          "Creates an Autopilot workflow, or replaces an existing one's steps when workflowId is given. Steps are laid out automatically.",
        whenToUse:
          "The user asks Autopilot to keep an eye on something, wants a routine that keeps running, or asks to change one.",
        whenNotToUse: "They want a one-off answer now.",
        usageNotes:
          "Node ids are short slugs such as trigger, visibility, behind, plan, slack. Edges from a branching step name the branch in sourcePort, such as true, false, yes or no. Schedules are in UTC.",
      }),
      inputSchema: saveAutopilotWorkflowInputSchema,
      execute: async (input) => {
        const result = await saveAutopilotWorkflow({
          organizationId,
          userId,
          input,
        });
        return result.ok
          ? {
              ...result,
              path: await workflowPath(organizationId, result.workflowId),
            }
          : result;
      },
    }),
    [AUTOPILOT_WORKFLOW_RUN_TOOL_NAME]: tool({
      description: toolDescription({
        toolName: "runAutopilotWorkflow",
        intro: "Starts an Autopilot workflow now. It runs in the background.",
        whenToUse: "The user asks to run or test a workflow.",
        usageNotes:
          "Agent steps use AI credits. Follow up with getAutopilotWorkflowRun to report what happened.",
      }),
      inputSchema: workflowIdToolInputSchema,
      execute: async ({ workflowId }) => {
        const runId = await runAutopilotWorkflow({
          organizationId,
          workflowId,
          trigger: "manual",
        });
        return runId
          ? { runId, path: await workflowPath(organizationId, workflowId) }
          : { error: `No Autopilot workflow "${workflowId}" exists` };
      },
    }),
  };
}

/**
 * Questions for the user. It has no execute: the chat shows them in place of
 * its input and sends the answers back as the tool's output.
 */
function questionTool(): Record<string, Tool> {
  return {
    [AGENT_QUESTION_TOOL_NAME]: tool({
      description: toolDescription({
        toolName: AGENT_QUESTION_TOOL_NAME,
        intro:
          "Asks the user one or more questions and waits for their answers before you continue.",
        whenToUse:
          "To gather preferences, clarify an ambiguous request or let the user decide between directions, such as which competitor to watch, how often to check or where to send the result.",
        usageNotes:
          'Ask related questions together in one call. A "Type your own answer" choice is added automatically, so don\'t add one. Set multiple to true when several options can apply. Put the option you recommend first and add "(Recommended)" to its label. Write nothing after calling it; the answers arrive as the tool result.',
      }),
      inputSchema: agentQuestionInputSchema,
      outputSchema: agentQuestionOutputSchema,
      // The answers come from the browser, so read them defensively.
      toModelOutput: ({ input, output }) => ({
        type: "text",
        value: formatAgentAnswers(
          readAgentQuestions(input),
          readAgentAnswers(output) ?? []
        ),
      }),
    }),
  };
}

/** Autopilot workflow tools for the agent, when Autopilot is on for the workspace. */
export async function buildAutopilotWorkflowTools(params: {
  organizationId: string;
  userId?: string;
  /** Only the dashboard agent can show the agent's questions. */
  surface?: ChatSurface;
  /** The workflow whose page the user is on. */
  focusWorkflowId?: string;
  /** The built-in automation whose page the user is on. */
  focusAutomation?: string;
}): Promise<ToolSet | undefined> {
  const { organizationId, userId, surface, focusWorkflowId, focusAutomation } =
    params;
  const [enabled, manager, focus] = await Promise.all([
    isAutopilotEnabledForOrganization(organizationId),
    canManage(organizationId, userId),
    focusNote(organizationId, { focusWorkflowId, focusAutomation }),
  ]);
  if (!enabled) {
    return undefined;
  }
  const canAsk = manager && surface === "dashboard-agent";
  return {
    descriptions: [
      [
        AUTOPILOT_WORKFLOW_AGENT_DESCRIPTION,
        canAsk ? AUTOPILOT_WORKFLOW_QUESTION_NOTE : null,
        manager ? null : AUTOPILOT_WORKFLOW_READ_ONLY_NOTE,
      ]
        .filter(Boolean)
        .join(" "),
      ...(focus ? [focus] : []),
    ],
    tools: {
      ...readTools(organizationId),
      ...(manager ? manageTools(organizationId, userId) : {}),
      ...(canAsk ? questionTool() : {}),
    },
    // Saving schedules work and running spends credits or posts to Slack,
    // so the user approves both, like the chat's own schedule tool.
    approvalToolNames: manager
      ? [AUTOPILOT_WORKFLOW_SAVE_TOOL_NAME, AUTOPILOT_WORKFLOW_RUN_TOOL_NAME]
      : [],
    // A workflow that fails its checks saves nothing, so it goes straight
    // back to the agent to fix instead of asking the user to approve it.
    skipsApproval: async (toolName, input) => {
      if (toolName !== AUTOPILOT_WORKFLOW_SAVE_TOOL_NAME) {
        return false;
      }
      const parsed = saveAutopilotWorkflowInputSchema.safeParse(input);
      return (
        !parsed.success ||
        (await findAutopilotWorkflowSaveIssues(organizationId, parsed.data))
          .length > 0
      );
    },
  };
}
