import { logError, logWarn } from "@notra/ai/utils/server-log";
import { getSessionAttribute } from "@notra/tools/utils/session";
import type { ChannelEventContext } from "eve/channels";
import {
  defineSlackRenderer,
  type SlackContext,
  type SlackEventContext,
} from "eve/channels/slack";
import { call as findCall, idle } from "eve/events";

import {
  SLACK_WORKING_LOADING_MESSAGES,
  SLACK_WORKING_STATUS,
  CREATE_POST_TOOL_NAMES,
  SLACK_ARTIFACT_TOOL_NAMES,
  SLACK_PERMISSION_ERROR_PATTERN,
  SLACK_SESSION_FAILED_MESSAGE,
  SLACK_TURN_FAILED_MESSAGE,
} from "../constants/slack";
import {
  mirrorAssistantDelta,
  mirrorSessionStatus,
  mirrorToolApprovals,
  mirrorToolResult,
} from "./chat-mirror";
import { buildSlackArtifactPost } from "./slack-artifact";
import { getSlackAuthUserId } from "./slack-auth";
import { uploadSlackChart } from "./slack-chart";
import { offerSavedTweetPublishing } from "./slack-input-request";
import { runWithSlackTeam } from "./slack-installation";
import {
  finishSlackTurnMetrics,
  markSlackTurnResponded,
  recordSlackTurnTool,
  startSlackTurnMetrics,
} from "./slack-metrics";
import { notifySlackDraftCreated } from "./slack-notifications";
import {
  clearSlackWorkingReactions,
  trackSlackWorkingReactions,
} from "./slack-reactions";
import { postSlackReply, withErrorId } from "./slack-reply";
import { getNotraSlackState } from "./slack-state";

/**
 * Shows "On it…" with rotating loading messages. `thread.startTyping` can only
 * set one, so this calls Slack directly. Best-effort, like eve's own status.
 */
export async function showSlackWorkingStatus(
  channel: Pick<SlackContext, "slack">
): Promise<void> {
  const { slack } = channel;
  if (!slack.threadTs) {
    return;
  }
  try {
    const response = await slack.request("assistant.threads.setStatus", {
      channel_id: slack.channelId,
      thread_ts: slack.threadTs,
      status: SLACK_WORKING_STATUS,
      loading_messages: SLACK_WORKING_LOADING_MESSAGES,
    });
    if (!response.ok) {
      logWarn("Slack working status failed", { error: response.error });
    }
  } catch (error) {
    logError("Slack working status failed", error);
  }
}

async function deliverToolResult(
  ctx: ChannelEventContext<SlackEventContext>,
  toolName: string,
  callId: string,
  turnId: string,
  output: unknown
): Promise<void> {
  const { channel } = ctx;
  const state = getNotraSlackState(channel.state);

  if (toolName === "add_reference") {
    state.notraReferenceCompletionTurnId = turnId;
    return;
  }

  if (SLACK_ARTIFACT_TOOL_NAMES.has(toolName)) {
    try {
      const post = buildSlackArtifactPost(output);
      if (post) {
        await channel.thread.post(post);
        await markSlackTurnResponded(channel.state);
      }
    } catch (error) {
      logError("Slack artifact delivery failed", error, {
        sessionId: ctx.session.id,
      });
    }
    return;
  }

  if (toolName === "create_chart") {
    try {
      await uploadSlackChart(
        channel.slack,
        output,
        JSON.stringify([ctx.session.id, turnId])
      );
      await markSlackTurnResponded(channel.state);
    } catch (error) {
      logError("Slack chart delivery failed", error, {
        sessionId: ctx.session.id,
      });
      state.notraChartFailureTurnId = turnId;
      state.notraChartFailureIsPermission = SLACK_PERMISSION_ERROR_PATTERN.test(
        String(error)
      );
    }
    return;
  }

  if (!CREATE_POST_TOOL_NAMES.has(toolName)) {
    return;
  }

  const current = state.notraDraftCompletion;
  state.notraDraftCompletion = {
    count: current?.turnId === turnId ? current.count + 1 : 1,
    turnId,
  };
  await notifySlackDraftCreated(ctx, toolName);
  if (
    toolName !== "create_twitter_post" ||
    typeof output !== "object" ||
    output === null ||
    !("postId" in output) ||
    typeof output.postId !== "string"
  ) {
    return;
  }
  const organizationId = getSessionAttribute(ctx, "organizationId");
  if (!organizationId) {
    return;
  }
  const posted = await offerSavedTweetPublishing(
    channel,
    organizationId,
    output.postId,
    callId,
    getSlackAuthUserId(ctx.session.auth.current)
  );
  if (posted) {
    await markSlackTurnResponded(channel.state);
  }
}

/**
 * Picks the message that answers a finished turn: a chart failure notice, the
 * Post to X / reference / draft summary instead of the model's recap, or the
 * model's reply. Returns `false` when eve's default should handle it.
 */
async function postFinalReply(
  channel: SlackEventContext,
  turnId: string | undefined,
  reply: string
): Promise<boolean> {
  const state = getNotraSlackState(channel.state);
  if (turnId && state.notraChartFailureTurnId === turnId) {
    state.notraChartFailureTurnId = undefined;
    await channel.thread.post(
      state.notraChartFailureIsPermission
        ? "I couldn't upload the chart because the Slack app is missing a permission. Reinstall Notra in Slack so it can post files, then try again."
        : "I couldn't render or upload the chart. Try again, or ask for the numbers as a table instead."
    );
    state.notraChartFailureIsPermission = undefined;
  }
  const completion = state.notraDraftCompletion;
  const hasContentPullRequestResult =
    turnId !== undefined &&
    (state.notraContentPullRequestTurnIds?.includes(turnId) ?? false);
  state.notraContentPullRequestTurnIds =
    state.notraContentPullRequestTurnIds?.filter((id) => id !== turnId);
  const referenceCompletionTurnId = state.notraReferenceCompletionTurnId;
  state.notraDraftCompletion = undefined;
  state.notraReferenceCompletionTurnId = undefined;

  if (!hasContentPullRequestResult && turnId !== undefined) {
    if (referenceCompletionTurnId === turnId) {
      await channel.thread.post("Saved as a reference.");
      return true;
    }
    if (completion?.turnId === turnId) {
      await channel.thread.post(
        completion.count === 1
          ? "Saved as a draft."
          : `Saved ${completion.count} drafts.`
      );
      return true;
    }
  }

  if (!reply) {
    return false;
  }
  await postSlackReply(channel, reply);
  return true;
}

/**
 * Notra's Slack rendering on top of eve's default: eve keeps the thread
 * status, task card and approval cards, and this adds the 👀 reaction, the
 * dashboard mirror, metrics, tool deliveries and Notra's own replies.
 */
export const notraSlackRenderer = defineSlackRenderer({
  // eve acknowledges mentions and DMs before Notra's hooks decide whether to
  // answer. `onSlackMessage` shows the status once a message passes its
  // checks, so blocked messages never show progress.
  received() {
    return Promise.resolve();
  },
  events: {
    async "turn.started"(event, ctx, next) {
      const { channel } = ctx;
      await runWithSlackTeam(channel.state.installationTeamId, async () => {
        startSlackTurnMetrics(channel.state, event.data.turnId);
        trackSlackWorkingReactions(getNotraSlackState(channel.state), ctx);
        await mirrorSessionStatus(ctx, "working");
        await next();
      });
    },

    async "content.delta"(event, ctx, next) {
      await mirrorAssistantDelta(ctx, event);
      // Notra never shows the model's reasoning in the thread status. Only a
      // part's first delta names its kind, and eve ignores the rest of a part
      // it never saw announced.
      if (event.data.kind !== "reasoning") {
        await next();
      }
    },

    async "call.settled"(event, ctx, next) {
      const { channel } = ctx;
      await runWithSlackTeam(channel.state.installationTeamId, async () => {
        await next();
        await mirrorToolResult(ctx, event);
        const settled = findCall(ctx.view, event.data.callId);
        const turnId = event.scope?.turnId ?? settled?.turnId;
        // Task waits and cancels and skill loads are not tool results.
        if (
          !(settled && (settled.kind === "tool" || settled.kind === "agent")) ||
          !turnId
        ) {
          return;
        }
        recordSlackTurnTool(channel.state, settled.name);
        if (settled.name === "create_content_pull_request") {
          const state = getNotraSlackState(channel.state);
          state.notraContentPullRequestTurnIds = [
            ...new Set([
              ...(state.notraContentPullRequestTurnIds ?? []),
              turnId,
            ]),
          ];
        }
        if (event.data.outcome !== "completed") {
          return;
        }
        await deliverToolResult(
          ctx,
          settled.name,
          event.data.callId,
          turnId,
          event.data.output
        );
      });
    },

    async "interaction.opened"(event, ctx, next) {
      const { state } = ctx.channel;
      await runWithSlackTeam(state.installationTeamId, async () => {
        if (event.data.request.kind !== "sign-in") {
          await markSlackTurnResponded(state);
        }
        await next();
        await mirrorToolApprovals(ctx, event);
        await mirrorSessionStatus(ctx, "idle");
      });
    },

    async "content.completed"(event, ctx, next) {
      const { data } = event;
      if (data.kind === "reasoning") {
        return;
      }
      if (data.kind !== "text" || data.phase !== "reply") {
        await next();
        return;
      }
      const { channel } = ctx;
      await runWithSlackTeam(channel.state.installationTeamId, async () => {
        await markSlackTurnResponded(channel.state);
        // The answer is about to be posted, so the 👀 comes off now rather
        // than when the turn finishes.
        await Promise.all([
          mirrorSessionStatus(ctx, "idle"),
          clearSlackWorkingReactions(channel, ctx),
        ]);
        const reply = typeof data.value === "string" ? data.value : "";
        if (!(await postFinalReply(channel, event.scope?.turnId, reply))) {
          await next();
        }
      });
    },

    // Turns parked on an approval, question or sign-in.
    async "turn.paused"(_event, ctx, next) {
      const { channel } = ctx;
      await runWithSlackTeam(channel.state.installationTeamId, async () => {
        await clearSlackWorkingReactions(channel, ctx);
        await next();
      });
    },

    async "turn.settled"(event, ctx, next) {
      const { channel } = ctx;
      const { data } = event;
      await runWithSlackTeam(channel.state.installationTeamId, async () => {
        await finishSlackTurnMetrics(
          channel.state,
          ctx.session.id,
          data.outcome,
          data.outcome === "failed" ? data.error?.code : undefined
        );
        if (data.outcome !== "completed") {
          await mirrorSessionStatus(ctx, "idle");
        }
        if (data.outcome === "failed") {
          const errorId = data.error?.id ?? null;
          logError("Slack agent turn failed", data.error?.message, {
            sessionId: ctx.session.id,
            code: data.error?.code,
            errorId,
          });
          await channel.thread.post(
            withErrorId(SLACK_TURN_FAILED_MESSAGE, errorId)
          );
        } else {
          await next();
        }
        await clearSlackWorkingReactions(channel, ctx);
      });
    },

    // Messages that never ran a turn, such as ones a session refused.
    async "delivery.settled"(_event, ctx, next) {
      await next();
      if (!idle(ctx.view)) {
        return;
      }
      const { channel } = ctx;
      await runWithSlackTeam(channel.state.installationTeamId, () =>
        clearSlackWorkingReactions(channel, ctx)
      );
    },

    async "session.ended"(event, ctx, next) {
      const { data } = event;
      if (data.outcome !== "failed") {
        await next();
        return;
      }
      const { channel } = ctx;
      await runWithSlackTeam(channel.state.installationTeamId, async () => {
        await clearSlackWorkingReactions(channel);
        const errorId = data.error?.id ?? null;
        logError("Slack agent session failed", data.error?.message, {
          code: data.error?.code,
          sessionId: ctx.session.id,
          errorId,
        });
        await channel.thread.post(
          withErrorId(SLACK_SESSION_FAILED_MESSAGE, errorId)
        );
      });
    },
  },
});
