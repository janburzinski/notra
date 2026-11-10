import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { slackAgentRequests } from "@notra/db/schema";
import { and, eq, isNull, lt } from "drizzle-orm";
import type { SlackChannelState, SlackMessage } from "eve/channels/slack";

import type { SlackRequestTrigger, SlackTurnOutcome } from "../types/slack";
import { getNotraSlackState } from "./slack-state";

/** Slack `ts` values are epoch seconds with a microsecond suffix. */
function slackTsToDate(ts: string): Date {
  const seconds = Number(ts);
  return Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date();
}

export async function recordSlackRequest(input: {
  organizationId: string;
  teamId: string;
  message: SlackMessage;
  trigger: SlackRequestTrigger;
  blocked?: boolean;
}): Promise<void> {
  const { message } = input;
  try {
    await db
      .insert(slackAgentRequests)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        slackTeamId: input.teamId,
        channelId: message.channelId,
        threadTs: message.threadTs,
        messageTs: message.ts,
        slackUserId: message.author?.userId ?? null,
        trigger: input.trigger,
        status: input.blocked ? "blocked" : "pending",
        sentAt: slackTsToDate(message.ts),
      })
      .onConflictDoNothing();
  } catch (error) {
    logError("Slack request metrics insert failed", error, {
      channelId: message.channelId,
    });
  }
}

/** The message that started the turn; a message arriving mid-turn must not take its result. */
export function startSlackTurnMetrics(
  state: SlackChannelState,
  turnId: string
) {
  getNotraSlackState(state).notraTurnMetrics = {
    turnId,
    messageTs: state.triggeringMessageTs ?? null,
    startedAt: Date.now(),
    toolNames: [],
  };
}

function requestScope(state: SlackChannelState) {
  const teamId = state.installationTeamId ?? state.teamId;
  const metrics = getNotraSlackState(state).notraTurnMetrics;
  const messageTs = metrics ? metrics.messageTs : state.triggeringMessageTs;
  if (!(teamId && state.channelId && messageTs)) {
    return null;
  }
  return { teamId, channelId: state.channelId, messageTs };
}

function requestWhere(scope: NonNullable<ReturnType<typeof requestScope>>) {
  return and(
    eq(slackAgentRequests.slackTeamId, scope.teamId),
    eq(slackAgentRequests.channelId, scope.channelId),
    eq(slackAgentRequests.messageTs, scope.messageTs)
  );
}

/**
 * Saved right away: a turn parked on an approval card can wait for hours, and
 * the person already has their reply.
 */
export async function markSlackTurnResponded(
  state: SlackChannelState
): Promise<void> {
  const metrics = getNotraSlackState(state).notraTurnMetrics;
  if (!metrics || metrics.firstResponseAt !== undefined) {
    return;
  }
  metrics.firstResponseAt = Date.now();
  const scope = requestScope(state);
  if (!scope) {
    return;
  }
  try {
    await db
      .update(slackAgentRequests)
      .set({
        startedAt: new Date(metrics.startedAt),
        firstResponseAt: new Date(metrics.firstResponseAt),
      })
      .where(
        and(requestWhere(scope), isNull(slackAgentRequests.firstResponseAt))
      );
  } catch (error) {
    logError("Slack first reply metrics update failed", error, {
      turnId: metrics.turnId,
    });
  }
}

/** Keeps the counts but drops who asked once a workspace removes the app. */
export async function anonymizeSlackRequests(teamId: string): Promise<void> {
  try {
    await db
      .update(slackAgentRequests)
      .set({ slackUserId: null })
      .where(eq(slackAgentRequests.slackTeamId, teamId));
  } catch (error) {
    logError("Slack request anonymization failed", error, { teamId });
  }
}

export function recordSlackTurnTool(
  state: SlackChannelState,
  toolName: string
) {
  getNotraSlackState(state).notraTurnMetrics?.toolNames.push(toolName);
}

export async function finishSlackTurnMetrics(
  state: SlackChannelState,
  sessionId: string,
  outcome: SlackTurnOutcome,
  errorCode?: string
): Promise<void> {
  const scope = requestScope(state);
  const notraState = getNotraSlackState(state);
  const metrics = notraState.notraTurnMetrics;
  notraState.notraTurnMetrics = undefined;
  if (!scope) {
    return;
  }
  const finishedAt = new Date();
  const firstResponseAt = metrics?.firstResponseAt
    ? new Date(metrics.firstResponseAt)
    : undefined;
  try {
    await db
      .update(slackAgentRequests)
      .set({
        status: outcome,
        sessionId,
        turnId: metrics?.turnId,
        toolNames: metrics?.toolNames ?? [],
        errorCode: errorCode ?? null,
        startedAt: metrics ? new Date(metrics.startedAt) : undefined,
        firstResponseAt,
        finishedAt,
      })
      .where(requestWhere(scope));
    if (state.threadTs) {
      // Messages sent while the agent was busy are answered by this turn
      // instead of getting their own.
      await db
        .update(slackAgentRequests)
        .set({
          status: outcome,
          sessionId,
          turnId: metrics?.turnId,
          errorCode: errorCode ?? null,
          firstResponseAt,
          finishedAt,
        })
        .where(
          and(
            eq(slackAgentRequests.slackTeamId, scope.teamId),
            eq(slackAgentRequests.channelId, scope.channelId),
            eq(slackAgentRequests.threadTs, state.threadTs),
            eq(slackAgentRequests.status, "pending"),
            lt(slackAgentRequests.sentAt, slackTsToDate(scope.messageTs))
          )
        );
    }
  } catch (error) {
    logError("Slack turn metrics update failed", error, { sessionId });
  }
}
