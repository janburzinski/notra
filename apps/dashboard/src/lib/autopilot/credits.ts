import {
  allowUnmeteredAiInDevelopment,
  autumn,
  AUTUMN_READ_TIMEOUT_MS,
} from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { GITHUB_MENTION_MINIMUM_CREDITS } from "@notra/ai/constants/github-mention-billing";
import { logError } from "@notra/ai/utils/server-log";
import { getAppUrl } from "@notra/ai/utils/url";
import { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import { autopilotRuns, organizations } from "@notra/db/schema";
import { and, desc, eq, gt, inArray, isNotNull, ne } from "drizzle-orm";

import { AUTOPILOT_NO_CREDITS_MESSAGE } from "@/constants/autopilot";
import { AUTOPILOT_DAILY_WORKFLOW_KEY } from "@/constants/workflow-engine";
import { loadSlackDestination } from "@/lib/autopilot/brief";
import { postAutopilotSlackMessage } from "@/lib/autopilot/slack";
import type { AutopilotCreditState } from "@/types/autopilot-runtime";
import { autopilotSlackMessageId } from "@/utils/autopilot-delivery";
import { autopilotLocalDayStart } from "@/utils/autopilot-schedule";

async function hasBalance(organizationId: string, featureId: string) {
  const data = await autumn?.check(
    {
      customerId: organizationId,
      featureId,
      requiredBalance: GITHUB_MENTION_MINIMUM_CREDITS,
    },
    { timeoutMs: AUTUMN_READ_TIMEOUT_MS }
  );
  return data?.allowed === true;
}

/**
 * Whether Autopilot has anything to spend: the plan's pull request credits
 * first, then AI credits, the same order a draft is billed in.
 */
export async function resolveAutopilotCredits(
  organizationId: string
): Promise<AutopilotCreditState> {
  if (!autumn || allowUnmeteredAiInDevelopment) {
    return "available";
  }
  try {
    if (await hasBalance(organizationId, FEATURES.PULL_REQUEST_CREDITS)) {
      return "available";
    }
    return (await hasBalance(organizationId, FEATURES.AI_CREDITS))
      ? "available"
      : "exhausted";
  } catch (error) {
    logError("[Autopilot] Credit check failed", error, { organizationId });
    return "unknown";
  }
}

async function postOutOfCreditsNotice(organizationId: string, runId: string) {
  const [send, organization] = await Promise.all([
    loadSlackDestination(organizationId),
    db.query.organizations.findFirst({
      columns: { slug: true },
      where: eq(organizations.id, organizationId),
    }),
  ]);
  if (!(send && organization)) {
    return null;
  }
  const creditsUrl = `${getAppUrl() ?? ""}/${organization.slug}?settings=credits`;
  const text =
    "Autopilot is paused: this workspace has no pull request or AI credits left, so today's run was skipped. It starts again by itself when credits reset or you top up.";
  const delivered = await postAutopilotSlackMessage({
    ...send,
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Add credits" },
            url: creditsUrl,
          },
        ],
      },
    ],
    clientMessageId: autopilotSlackMessageId(runId),
  });
  return delivered.ts;
}

/**
 * Records a scheduled run that was skipped for lack of credits, so it shows
 * in the run history and ends the day's attempts. Its id is fixed per local
 * day, so overlapping cron ticks record it once. Slack is told once per
 * outage: until a notice went out since Autopilot last ran, each skip tries.
 */
export async function skipScheduledRunForCredits(
  organizationId: string,
  timezone: string,
  now: Date
) {
  const dayStart = autopilotLocalDayStart(timezone, now).getTime();
  const runId = `skip_${dayStart}_${organizationId}`;
  const inserted = await db
    .insert(autopilotRuns)
    .values({
      id: runId,
      organizationId,
      trigger: "cron",
      workflowKey: AUTOPILOT_DAILY_WORKFLOW_KEY,
      status: "skipped",
      errorMessage: AUTOPILOT_NO_CREDITS_MESSAGE,
      startedAt: now,
      heartbeatAt: now,
      finishedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: autopilotRuns.id });
  if (inserted.length === 0) {
    return;
  }
  const lastRun = await db.query.autopilotRuns.findFirst({
    columns: { startedAt: true },
    where: and(
      eq(autopilotRuns.organizationId, organizationId),
      inArray(autopilotRuns.trigger, AUTOPILOT_SCHEDULED_TRIGGERS),
      ne(autopilotRuns.status, "skipped")
    ),
    orderBy: [desc(autopilotRuns.startedAt)],
  });
  const notified = await db.query.autopilotRuns.findFirst({
    columns: { id: true },
    where: and(
      eq(autopilotRuns.organizationId, organizationId),
      eq(autopilotRuns.status, "skipped"),
      isNotNull(autopilotRuns.slackMessageTs),
      lastRun ? gt(autopilotRuns.startedAt, lastRun.startedAt) : undefined
    ),
  });
  if (notified) {
    return;
  }
  try {
    const ts = await postOutOfCreditsNotice(organizationId, runId);
    if (ts) {
      await db
        .update(autopilotRuns)
        .set({ slackMessageTs: ts })
        .where(eq(autopilotRuns.id, runId));
    }
  } catch (error) {
    logError("[Autopilot] Out-of-credits notice failed", error, {
      organizationId,
    });
  }
}
