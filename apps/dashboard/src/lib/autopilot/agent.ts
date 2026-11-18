import type { autopilotAgentRequestSchema } from "@notra/ai/schemas/autopilot-agent";
import { consumeChatGenerationRateLimit } from "@notra/ai/utils/chat-generation-rate-limit";
import { AUTOPILOT_DEFAULT_JOBS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
  organizationNotificationSettings,
  workflowRuns,
} from "@notra/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type * as z from "zod";

import {
  AUTOPILOT_ACCESS_CHECK_FAILED_MESSAGE,
  AUTOPILOT_UPGRADE_REQUIRED_MESSAGE,
} from "@/constants/autopilot";
import {
  AUTOPILOT_WORKFLOW_KEY_PREFIX,
  AUTOPILOT_WORKFLOW_NOT_FOUND,
  AUTOPILOT_WORKFLOW_RATE_LIMITED,
} from "@/constants/autopilot-workflows";
import { loadRecentDailyNotes } from "@/lib/autopilot/daily-notes";
import {
  dismissFindingWithFeedback,
  writeSuggestedFinding,
} from "@/lib/autopilot/finding-actions";
import { mergeFinding } from "@/lib/autopilot/findings";
import { addRule, deleteRule, listRules } from "@/lib/autopilot/rules";
import {
  AutopilotSettingsError,
  updateAutopilotSettings,
} from "@/lib/autopilot/settings";
import { startAutopilot } from "@/lib/autopilot/start";
import { stopAutopilotRun } from "@/lib/autopilot/stop";
import {
  AutopilotWorkflowBusyError,
  listAutopilotWorkflows,
  runAutopilotWorkflow,
  setAutopilotWorkflowEnabled,
  stopAutopilotWorkflowRun,
} from "@/lib/autopilot/workflows/service";
import { autopilotAccessState } from "@/lib/billing/autopilot-entitlement";
import { resolveSlackMember } from "@/lib/integrations/slack/member";
import { canManageAutopilot } from "@/utils/autopilot-permissions";

type AgentRequest = z.infer<typeof autopilotAgentRequestSchema>;
type AgentAction = AgentRequest["action"];

export class AutopilotAgentError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AutopilotAgentError";
    this.status = status;
  }
}

const OPEN_FINDING_STATUSES = ["suggested", "open", "proposed"] as const;
const ACTIVE_WORKFLOW_RUN_STATUSES = ["queued", "running"] as const;

function badRequest(error: unknown): never {
  throw new AutopilotAgentError(
    400,
    error instanceof Error && error.message ? error.message : String(error)
  );
}

function summarizeFinding(finding: typeof autopilotFindings.$inferSelect) {
  return {
    id: finding.id,
    kind: finding.kind,
    title: finding.title,
    status: finding.status,
    pullRequestUrl: finding.pullRequestUrl,
  };
}

async function requireFinding(organizationId: string, findingId: string) {
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  if (!finding) {
    throw new AutopilotAgentError(404, "Autopilot finding not found");
  }
  return finding;
}

async function loadStatus(
  organizationId: string,
  slack: AgentRequest["slack"],
  role: string
) {
  const [
    settings,
    runs,
    workflows,
    workflowRunRows,
    openFindings,
    rules,
    recentDays,
  ] = await Promise.all([
    db.query.autopilotSettings.findFirst({
      where: eq(autopilotSettings.organizationId, organizationId),
    }),
    db.query.autopilotRuns.findMany({
      where: and(
        eq(autopilotRuns.organizationId, organizationId),
        eq(autopilotRuns.status, "running")
      ),
      orderBy: [desc(autopilotRuns.startedAt)],
      limit: 5,
    }),
    listAutopilotWorkflows(organizationId),
    db
      .select({
        id: workflowRuns.id,
        workflowKey: workflowRuns.workflowKey,
        status: workflowRuns.status,
      })
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.organizationId, organizationId),
          isNull(workflowRuns.parentRunId),
          sql`${workflowRuns.workflowKey} like ${`${AUTOPILOT_WORKFLOW_KEY_PREFIX}%`}`,
          inArray(workflowRuns.status, ACTIVE_WORKFLOW_RUN_STATUSES)
        )
      )
      .limit(10),
    db.query.autopilotFindings.findMany({
      where: and(
        eq(autopilotFindings.organizationId, organizationId),
        inArray(autopilotFindings.status, OPEN_FINDING_STATUSES)
      ),
      orderBy: [desc(autopilotFindings.updatedAt)],
      limit: 15,
    }),
    listRules(organizationId),
    loadRecentDailyNotes(organizationId),
  ]);
  const threadFindings =
    slack.channelId && slack.threadTs
      ? await db.query.autopilotFindings.findMany({
          where: and(
            eq(autopilotFindings.organizationId, organizationId),
            sql`${autopilotFindings.evidence}->'slackMessage'->>'channel' = ${slack.channelId}`,
            sql`${autopilotFindings.evidence}->'slackMessage'->>'threadTs' = ${slack.threadTs}`
          ),
          orderBy: [desc(autopilotFindings.updatedAt)],
          limit: 20,
        })
      : [];
  return {
    canManage: canManageAutopilot(role),
    settings: settings
      ? {
          enabled: settings.enabled,
          briefHour: settings.briefHour,
          timezone: settings.timezone,
          jobs: { ...AUTOPILOT_DEFAULT_JOBS, ...settings.jobs },
          repository:
            settings.repositoryOwner && settings.repositoryName
              ? `${settings.repositoryOwner}/${settings.repositoryName}`
              : null,
          slackChannelName: settings.slackChannelName,
          reviewers: settings.reviewers,
          lastRunAt: settings.lastRunAt?.toISOString() ?? null,
        }
      : null,
    activeRuns: [
      ...runs.map((run) => ({
        runId: run.id,
        type: "autopilot" as const,
        trigger: run.trigger,
        workflowKey: run.workflowKey,
        startedAt: run.startedAt.toISOString(),
      })),
      ...workflowRunRows.map((run) => ({
        runId: run.id,
        type: "custom_workflow" as const,
        workflowId:
          run.workflowKey?.slice(AUTOPILOT_WORKFLOW_KEY_PREFIX.length) ?? null,
        status: run.status,
      })),
    ],
    workflows: workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      enabled: workflow.enabled,
      schedule: workflow.schedule,
      lastRunAt: workflow.lastRunAt?.toISOString() ?? null,
    })),
    threadFindings: threadFindings.map(summarizeFinding),
    openFindings: openFindings.map(summarizeFinding),
    rules: rules.map((rule) => ({ id: rule.id, text: rule.text })),
    recentDays,
  };
}

async function runAction(
  organizationId: string,
  action: Exclude<AgentAction, { type: "status" }>,
  member: { userId: string; email: string }
) {
  switch (action.type) {
    case "update_settings": {
      try {
        await updateAutopilotSettings(organizationId, action.input);
      } catch (error) {
        if (error instanceof AutopilotSettingsError) {
          badRequest(error);
        }
        throw error;
      }
      if (action.input.draftEmails === "always") {
        const notifications =
          await db.query.organizationNotificationSettings.findFirst({
            columns: { autopilotDrafts: true },
            where: eq(
              organizationNotificationSettings.organizationId,
              organizationId
            ),
          });
        if (notifications && !notifications.autopilotDrafts) {
          return {
            success: true as const,
            note: "Saved, but draft emails are off in Settings → Notifications, so no email goes out until an owner turns on Drafts to review.",
          };
        }
      }
      return { success: true as const };
    }
    case "run": {
      try {
        return await startAutopilot(
          organizationId,
          "manual",
          action.input.kind
        );
      } catch (error) {
        return badRequest(error);
      }
    }
    case "stop": {
      const { runId } = action.input;
      if (await stopAutopilotRun({ organizationId, runId })) {
        return { stopped: "autopilot" as const };
      }
      if (await stopAutopilotWorkflowRun(organizationId, runId)) {
        return { stopped: "custom_workflow" as const };
      }
      throw new AutopilotAgentError(
        404,
        "No running Autopilot run with that id"
      );
    }
    case "finding": {
      const finding = await requireFinding(
        organizationId,
        action.input.findingId
      );
      try {
        if (action.input.action === "write") {
          const runId = await writeSuggestedFinding(organizationId, finding.id);
          return { status: "writing" as const, runId };
        }
        if (action.input.action === "merge") {
          const merged = await mergeFinding(organizationId, finding.id);
          return {
            status: merged.status,
            pullRequestUrl: merged.pullRequestUrl,
          };
        }
        const dismissed = await dismissFindingWithFeedback({
          organizationId,
          findingId: finding.id,
          reason: action.input.reason,
          createdBy: member.email,
          origin: "slack",
        });
        return { status: dismissed.finding.status, rule: dismissed.rule };
      } catch (error) {
        return badRequest(error);
      }
    }
    case "add_rule": {
      const saved = await addRule({
        organizationId,
        text: action.input.text,
        source: "dashboard",
        createdBy: member.email,
      });
      if (saved.status === "full") {
        throw new AutopilotAgentError(
          400,
          "Autopilot has the maximum number of rules. Remove one first."
        );
      }
      return {
        status: saved.status,
        ruleId: saved.status === "added" ? saved.rule.id : null,
      };
    }
    case "delete_rule": {
      const rules = await listRules(organizationId);
      if (!rules.some((rule) => rule.id === action.input.ruleId)) {
        throw new AutopilotAgentError(404, "Autopilot rule not found");
      }
      await deleteRule(organizationId, action.input.ruleId);
      return { success: true as const };
    }
    case "set_workflow": {
      const result = await setAutopilotWorkflowEnabled(
        organizationId,
        action.input.workflowId,
        action.input.enabled
      );
      if (!result) {
        throw new AutopilotAgentError(404, AUTOPILOT_WORKFLOW_NOT_FOUND);
      }
      return { enabled: action.input.enabled, warning: result.warning };
    }
    case "run_workflow": {
      const limit = await consumeChatGenerationRateLimit(
        organizationId,
        member.userId
      );
      if (!limit.success) {
        throw new AutopilotAgentError(429, AUTOPILOT_WORKFLOW_RATE_LIMITED);
      }
      let runId: string | null;
      try {
        runId = await runAutopilotWorkflow({
          organizationId,
          workflowId: action.input.workflowId,
          trigger: "manual",
        });
      } catch (error) {
        if (error instanceof AutopilotWorkflowBusyError) {
          throw new AutopilotAgentError(409, error.message);
        }
        throw error;
      }
      if (!runId) {
        throw new AutopilotAgentError(404, AUTOPILOT_WORKFLOW_NOT_FOUND);
      }
      return { runId };
    }
    default:
      throw new AutopilotAgentError(400, "Unknown Autopilot action");
  }
}

export async function handleAutopilotAgentRequest(request: AgentRequest) {
  const { organizationId, slack, action } = request;
  const availability = await autopilotAccessState(organizationId);
  if (availability === "unavailable") {
    throw new AutopilotAgentError(503, AUTOPILOT_ACCESS_CHECK_FAILED_MESSAGE);
  }
  if (availability === "disabled") {
    throw new AutopilotAgentError(402, AUTOPILOT_UPGRADE_REQUIRED_MESSAGE);
  }
  const member = await resolveSlackMember(
    organizationId,
    slack.teamId,
    slack.userId
  );
  if (member.status === "missing_scope") {
    throw new AutopilotAgentError(
      403,
      "Notra can't look up Slack users yet. A workspace admin needs to reconnect Slack in Notra under Integrations > Slack to grant the new permissions."
    );
  }
  if (member.status !== "member") {
    throw new AutopilotAgentError(
      403,
      "This Slack account isn't linked to a member of this Notra workspace. Use the same verified email in Slack and Notra."
    );
  }
  if (action.type === "status") {
    return await loadStatus(organizationId, slack, member.role);
  }
  if (!canManageAutopilot(member.role)) {
    throw new AutopilotAgentError(
      403,
      "Only Notra workspace owners and admins can change Autopilot."
    );
  }
  return await runAction(organizationId, action, member);
}
