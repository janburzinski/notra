import { disableSlackIntegrationByTeamId } from "@notra/ai/integrations/slack-workspace";
import { logError } from "@notra/ai/utils/server-log";
import { getSessionAttribute } from "@notra/tools/utils/session";
import { getLinkedTwitterAccounts } from "@notra/tools/utils/social-accounts";
import { Effect } from "effect";
import {
  experimental_slackActivityRenderer,
  experimental_slackActivityStatus,
  type SlackChannelConfig,
  type SlackMentionResult,
  type SlackMessage,
  slackChannel,
} from "eve/channels/slack";

import {
  CREATE_POST_TOOL_NAMES,
  POST_TO_X_NOT_PENDING_MESSAGE,
  POST_TO_X_NOT_REQUESTER_MESSAGE,
  SLACK_WORKING_REACTIONS_KEY_ATTRIBUTE,
  SLACK_PERMISSION_ERROR_PATTERN,
  SLACK_SESSION_FAILED_MESSAGE,
  SLACK_TURN_FAILED_MESSAGE,
} from "../lib/constants/slack";
import {
  SLACK_LEAVE_ACTION_ID,
  SLACK_STOP_ACTION_ID,
} from "../lib/constants/slack-controls";
import {
  POST_TO_X_ACCOUNT_ACTION_PREFIX,
  POST_TO_X_CANCEL_ACTION_PREFIX,
  POST_TO_X_CONFIRM_ACTION_PREFIX,
  POST_TO_X_PUBLISH_ACTION_PREFIX,
} from "../lib/constants/slack-post-x";
import {
  SLACK_VOICE_FAILED_MESSAGE,
  SLACK_VOICE_TRANSCRIBING_STATUS,
} from "../lib/constants/slack-voice";
import type { SlackRequestTrigger } from "../lib/types/slack";
import type { SlackVoiceTranscription } from "../lib/types/slack-voice";
import {
  forwardAutopilotSlackAction,
  isLastAgentReply,
  parseAutopilotReaction,
} from "../lib/utils/autopilot-slack";
import {
  mirrorAssistantDelta,
  mirrorSessionStatus,
  mirrorToolApprovals,
  mirrorToolResult,
} from "../lib/utils/chat-mirror";
import {
  buildNotraSlackAuth,
  getSlackAuthUserId,
  resolveSlackActionInstallation,
} from "../lib/utils/slack-auth";
import { uploadSlackChart } from "../lib/utils/slack-chart";
import { mirrorPublicSlackThread } from "../lib/utils/slack-chat-mirror";
import {
  createSlackControlsRenderer,
  handleSlackControl,
  handleSlackControlAction,
  parseSlackControlMessage,
} from "../lib/utils/slack-controls";
import { createSlackAgentCredentials } from "../lib/utils/slack-credentials";
import {
  handleSlackInputRequested,
  offerSavedTweetPublishing,
} from "../lib/utils/slack-input-request";
import {
  evictSlackInstallation,
  isChannelAllowed,
  resolveSlackInstallation,
  runWithSlackInstallation,
  runWithSlackTeam,
} from "../lib/utils/slack-installation";
import {
  anonymizeSlackRequests,
  finishSlackTurnMetrics,
  markSlackTurnResponded,
  recordSlackRequest,
  recordSlackTurnTool,
  startSlackTurnMetrics,
} from "../lib/utils/slack-metrics";
import {
  getChannelNotEnabledMessage,
  notifySlackDraftCreated,
} from "../lib/utils/slack-notifications";
import {
  buildPostToXConfirmCard,
  dismissPostToXConfirmCard,
  getPostToXCompletionMessage,
  isPendingPostToXRequester,
  parsePostToXConfirmValue,
  publishPendingPostToX,
  readPendingPostToXForOrganization,
  switchPendingPostToXAccount,
} from "../lib/utils/slack-post-x";
import {
  addSlackWorkingReaction,
  clearSlackWorkingReactions,
  trackSlackWorkingReactions,
  withWorkingReactionRelease,
} from "../lib/utils/slack-reactions";
import { parseSlackDashboardRelay } from "../lib/utils/slack-relay";
import {
  getErrorId,
  postSlackReply,
  withErrorId,
} from "../lib/utils/slack-reply";
import { getNotraSlackState } from "../lib/utils/slack-state";
import { isPostToXRejection } from "../lib/utils/slack-tool-results";
import { checkSlackUsageLimits } from "../lib/utils/slack-usage-limits";
import {
  formatSlackVoiceContext,
  getSlackVoiceClips,
  transcribeSlackVoiceClips,
  withSlackVoiceTranscript,
} from "../lib/utils/slack-voice";
import { firstNonEmptyLine } from "../lib/utils/text";

const onSlackMessage = async (
  ctx: Parameters<NonNullable<SlackChannelConfig["onAppMention"]>>[0],
  message: SlackMessage,
  trigger: SlackRequestTrigger
): Promise<SlackMentionResult> => {
  const teamId = ctx.slack.installationTeamId;
  if (!teamId || message.author?.isBot) {
    return null;
  }
  const installation = await resolveSlackInstallation(teamId);
  if (!installation) {
    return null;
  }

  if (!isChannelAllowed(installation, message.channelId)) {
    const userId = message.author?.userId;
    if (ctx.isBotMentioned() && userId) {
      await recordSlackRequest({
        organizationId: installation.organizationId,
        teamId,
        message,
        trigger,
        blocked: true,
      });
      await runWithSlackInstallation(installation, () =>
        ctx.thread.postEphemeral(
          userId,
          getChannelNotEnabledMessage(installation)
        )
      );
    }
    return null;
  }

  const auth = buildNotraSlackAuth(ctx, message, installation);
  if (!auth) {
    return null;
  }

  return runWithSlackInstallation(installation, async () => {
    const control = parseSlackControlMessage(
      message.text,
      ctx.isBotMentioned()
    );
    if (control) {
      await handleSlackControl(control, ctx);
      return null;
    }
    const slackUserId = message.author?.userId;
    const usage = await checkSlackUsageLimits(
      installation.organizationId,
      slackUserId
        ? { teamId: installation.teamId, userId: slackUserId }
        : undefined
    );
    if (!usage.allowed) {
      await (slackUserId
        ? ctx.thread.postEphemeral(slackUserId, usage.message)
        : ctx.thread.post(usage.message));
      return null;
    }
    const voiceClips = getSlackVoiceClips(message);
    let voice: SlackVoiceTranscription | null = null;
    if (voiceClips.length > 0) {
      await ctx.thread.startTyping(SLACK_VOICE_TRANSCRIBING_STATUS);
      voice = await transcribeSlackVoiceClips(voiceClips, {
        botToken: installation.botToken,
        organizationId: installation.organizationId,
        billing: {
          chargeAiCredits: usage.attributes.chargeAiCredits === "true",
          useMarkup: usage.attributes.useMarkup === "true",
        },
      });
      if (!(voice.transcript || message.text.trim())) {
        await ctx.thread.post(SLACK_VOICE_FAILED_MESSAGE);
        return null;
      }
    }
    const [, workingReactionsKey] = await Promise.all([
      ctx.thread.startTyping("On it…"),
      addSlackWorkingReaction(ctx.slack, {
        installationTeamId: installation.teamId,
        channelId: message.channelId,
        threadTs: message.threadTs,
        ts: message.ts,
      }),
    ]);
    const [chatId] = await Promise.all([
      Effect.runPromise(
        mirrorPublicSlackThread(
          ctx,
          voice?.transcript
            ? withSlackVoiceTranscript(message, voice.transcript)
            : message,
          installation.organizationId
        )
      ),
      recordSlackRequest({
        organizationId: installation.organizationId,
        teamId,
        message,
        trigger,
      }),
    ]);
    return {
      ...(voice ? { context: [formatSlackVoiceContext(voice)] } : {}),
      auth: {
        ...auth,
        attributes: {
          ...auth.attributes,
          ...usage.attributes,
          ...(workingReactionsKey
            ? { [SLACK_WORKING_REACTIONS_KEY_ATTRIBUTE]: workingReactionsKey }
            : {}),
          ...(chatId ? { chatId } : {}),
        },
      },
    };
  });
};

const onSlackThreadReply: NonNullable<SlackChannelConfig["onMessage"]> = async (
  ctx,
  message
) => {
  if (message.author?.isBot) {
    return null;
  }
  const session = await ctx.resolveSession();
  if (!session) {
    return null;
  }
  const result = await onSlackMessage(
    { ...ctx, resolveSession: async () => session },
    message,
    "thread_reply"
  );
  if (!result) {
    return null;
  }
  // The pinned session can end (e.g. "leave") before eve delivers the message.
  const workingReactionsKey =
    result.auth?.attributes?.[SLACK_WORKING_REACTIONS_KEY_ATTRIBUTE];
  return {
    ...result,
    session:
      typeof workingReactionsKey === "string"
        ? withWorkingReactionRelease(session, ctx.slack, workingReactionsKey, {
            channelId: message.channelId,
            ts: message.ts,
          })
        : session,
  };
};

const onSlackInteraction: NonNullable<
  SlackChannelConfig["onInteraction"]
> = async (action, ctx) => {
  if (
    action.actionId === SLACK_STOP_ACTION_ID ||
    action.actionId === SLACK_LEAVE_ACTION_ID
  ) {
    const installation = await resolveSlackActionInstallation(
      ctx,
      action.user.id
    );
    if (!installation) {
      return;
    }
    await runWithSlackInstallation(installation, () =>
      handleSlackControlAction(action, ctx)
    );
    return;
  }
  if (action.actionId.startsWith(POST_TO_X_CONFIRM_ACTION_PREFIX)) {
    const parsed = parsePostToXConfirmValue(action.value);
    if (!parsed) {
      return;
    }
    const installation = await resolveSlackActionInstallation(
      ctx,
      action.user.id
    );
    if (!installation) {
      return;
    }
    await runWithSlackInstallation(installation, async () => {
      const pending = await readPendingPostToXForOrganization(
        parsed.callId,
        installation.organizationId
      );
      if (!pending) {
        await ctx.thread.postEphemeral(
          action.user.id,
          POST_TO_X_NOT_PENDING_MESSAGE
        );
        return;
      }
      if (!isPendingPostToXRequester(pending, action.user.id)) {
        await ctx.thread.postEphemeral(
          action.user.id,
          POST_TO_X_NOT_REQUESTER_MESSAGE
        );
        return;
      }
      try {
        const accounts = await getLinkedTwitterAccounts(
          installation.organizationId
        );
        await ctx.thread.post(
          buildPostToXConfirmCard({
            requestId: parsed.requestId,
            callId: parsed.callId,
            username: pending.username,
            accounts,
          })
        );
      } catch (error) {
        logError("Slack Post to X confirm failed", error, {
          callId: parsed.callId,
        });
        await ctx.thread.postEphemeral(
          action.user.id,
          "I couldn't load your linked X accounts. Please try again in a moment."
        );
      }
    });
    return;
  }

  if (action.actionId.startsWith(`${POST_TO_X_PUBLISH_ACTION_PREFIX}:`)) {
    const callId = action.value;
    if (!callId) {
      return;
    }
    const installation = await resolveSlackActionInstallation(
      ctx,
      action.user.id
    );
    if (!installation) {
      return;
    }
    await runWithSlackInstallation(installation, async () => {
      const pending = await readPendingPostToXForOrganization(
        callId,
        installation.organizationId
      );
      if (pending && !isPendingPostToXRequester(pending, action.user.id)) {
        await ctx.thread.postEphemeral(
          action.user.id,
          POST_TO_X_NOT_REQUESTER_MESSAGE
        );
        return;
      }
      const outcome = pending
        ? await publishPendingPostToX(callId, callId)
        : undefined;
      // No outcome means the post expired or another click already claimed it.
      await (outcome
        ? ctx.thread.post(getPostToXCompletionMessage(outcome, callId))
        : ctx.thread.postEphemeral(
            action.user.id,
            POST_TO_X_NOT_PENDING_MESSAGE
          ));
    });
    return;
  }

  if (action.actionId.startsWith(POST_TO_X_ACCOUNT_ACTION_PREFIX)) {
    const installation = await resolveSlackActionInstallation(
      ctx,
      action.user.id
    );
    if (!installation) {
      return;
    }
    const switched = await switchPendingPostToXAccount(
      action.selectedOptionValue,
      installation.organizationId,
      action.user.id
    );
    if (!switched) {
      await runWithSlackInstallation(installation, () =>
        ctx.thread.postEphemeral(
          action.user.id,
          POST_TO_X_NOT_REQUESTER_MESSAGE
        )
      );
    }
    return;
  }

  if (action.actionId.startsWith(POST_TO_X_CANCEL_ACTION_PREFIX)) {
    const installation = await resolveSlackActionInstallation(
      ctx,
      action.user.id
    );
    if (!installation) {
      return;
    }
    await runWithSlackInstallation(installation, () =>
      dismissPostToXConfirmCard(ctx, action.messageTs)
    );
  }
};

const onSlackInputResponse: NonNullable<
  SlackChannelConfig["onInputResponse"]
> = async (ctx, submission) => {
  const installation = await resolveSlackActionInstallation(
    ctx,
    submission.user.id
  );
  return installation ? { auth: ctx.defaultAuth } : null;
};

const onSlackEvent: NonNullable<SlackChannelConfig["onEvent"]> = async (
  ctx,
  event
) => {
  if (
    (event.type === "app_uninstalled" || event.type === "tokens_revoked") &&
    ctx.envelope.team_id
  ) {
    await disableSlackIntegrationByTeamId(ctx.envelope.team_id);
    evictSlackInstallation(ctx.envelope.team_id);
    await anonymizeSlackRequests(ctx.envelope.team_id);
    return;
  }

  const reaction = parseAutopilotReaction(ctx.envelope, event);
  if (reaction) {
    await forwardAutopilotSlackAction(reaction);
    return;
  }

  const relay = await parseSlackDashboardRelay(ctx.envelope, event);
  if (!relay) {
    return;
  }

  const usage = await checkSlackUsageLimits(relay.organizationId);
  await runWithSlackTeam(ctx.envelope.team_id, async () => {
    if (!usage.allowed) {
      await ctx.slack.request("chat.postMessage", {
        channel: relay.channelId,
        thread_ts: relay.threadTs,
        text: usage.message,
      });
      return;
    }
    await ctx.send(relay.message, {
      target: { channelId: relay.channelId, threadTs: relay.threadTs },
      auth: {
        ...relay.auth,
        attributes: { ...relay.auth.attributes, ...usage.attributes },
      },
    });
  });
};

const credentials = createSlackAgentCredentials();

export default slackChannel({
  credentials,
  activity: {
    renderers: [
      experimental_slackActivityRenderer(
        createSlackControlsRenderer(credentials.botToken)
      ),
      experimental_slackActivityStatus(),
    ],
  },
  events: {
    "action.result": async (data, channel, ctx) => {
      await mirrorToolResult(ctx, data);
      const result = data.result;
      const state = getNotraSlackState(channel.state);
      if (result.kind === "tool-result") {
        recordSlackTurnTool(channel.state, result.toolName);
      }

      if (
        result.kind === "tool-result" &&
        result.toolName === "create_content_pull_request"
      ) {
        state.notraContentPullRequestTurnIds = [
          ...new Set([
            ...(state.notraContentPullRequestTurnIds ?? []),
            data.turnId,
          ]),
        ];
      }

      if (
        data.status === "rejected" &&
        result.kind === "tool-result" &&
        result.toolName === "create_twitter_post" &&
        isPostToXRejection(result.output)
      ) {
        state.notraPostToXTurnId = data.turnId;
        state.notraPostToXOutcome = await runWithSlackTeam(
          channel.state.installationTeamId,
          () => publishPendingPostToX(result.callId, data.turnId)
        );
        return;
      }

      if (
        data.status !== "completed" ||
        result.kind !== "tool-result" ||
        result.isError
      ) {
        return;
      }

      if (result.toolName === "add_reference") {
        state.notraReferenceCompletionTurnId = data.turnId;
        return;
      }

      if (result.toolName === "create_chart") {
        try {
          await uploadSlackChart(
            channel.slack,
            result.output,
            JSON.stringify([ctx.session.id, data.turnId])
          );
          await markSlackTurnResponded(channel.state);
        } catch (error) {
          logError("Slack chart delivery failed", error, {
            sessionId: ctx.session.id,
          });
          state.notraChartFailureTurnId = data.turnId;
          state.notraChartFailureIsPermission =
            SLACK_PERMISSION_ERROR_PATTERN.test(String(error));
        }
        return;
      }

      if (!CREATE_POST_TOOL_NAMES.has(result.toolName)) {
        return;
      }

      const current = state.notraDraftCompletion;
      state.notraDraftCompletion = {
        count: current?.turnId === data.turnId ? current.count + 1 : 1,
        turnId: data.turnId,
      };
      await notifySlackDraftCreated(ctx, result.toolName);
      if (
        result.toolName === "create_twitter_post" &&
        typeof result.output === "object" &&
        result.output !== null &&
        "postId" in result.output &&
        typeof result.output.postId === "string"
      ) {
        const organizationId = getSessionAttribute(ctx, "organizationId");
        const postId = result.output.postId;
        if (organizationId) {
          const posted = await runWithSlackTeam(
            channel.state.installationTeamId,
            () =>
              offerSavedTweetPublishing(
                channel,
                organizationId,
                postId,
                result.callId,
                getSlackAuthUserId(ctx.session.auth.current)
              )
          );
          if (posted) {
            await markSlackTurnResponded(channel.state);
          }
        }
      }
    },
    "message.appended": async (data, _channel, ctx) => {
      await mirrorAssistantDelta(ctx, data);
    },
    "input.requested": (data, channel, ctx, defaultDeliver) =>
      runWithSlackTeam(channel.state.installationTeamId, async () => {
        await markSlackTurnResponded(channel.state);
        await handleSlackInputRequested(
          data,
          channel,
          defaultDeliver,
          getSlackAuthUserId(ctx.session.auth.current)
        );
        await mirrorToolApprovals(ctx, data);
        await mirrorSessionStatus(ctx, "idle");
      }),
    "message.completed": (data, channel, ctx) =>
      runWithSlackTeam(channel.state.installationTeamId, async () => {
        if (data.finishReason === "tool-calls") {
          channel.state.pendingToolCallMessage = data.message
            ? firstNonEmptyLine(data.message)
            : null;
          return;
        }

        await markSlackTurnResponded(channel.state);
        // The answer is about to be posted, so the 👀 comes off now rather
        // than when the turn finishes.
        await Promise.all([
          mirrorSessionStatus(ctx, "idle"),
          clearSlackWorkingReactions(channel, ctx),
        ]);
        channel.state.pendingToolCallMessage = null;
        const state = getNotraSlackState(channel.state);
        if (state.notraChartFailureTurnId === data.turnId) {
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
          state.notraContentPullRequestTurnIds?.includes(data.turnId) ?? false;
        state.notraContentPullRequestTurnIds =
          state.notraContentPullRequestTurnIds?.filter(
            (turnId) => turnId !== data.turnId
          );
        const postToXTurnId = state.notraPostToXTurnId;
        const referenceCompletionTurnId = state.notraReferenceCompletionTurnId;
        state.notraDraftCompletion = undefined;
        state.notraPostToXTurnId = undefined;
        state.notraReferenceCompletionTurnId = undefined;

        if (postToXTurnId === data.turnId) {
          await channel.thread.post(
            getPostToXCompletionMessage(state.notraPostToXOutcome, data.turnId)
          );
          state.notraPostToXOutcome = undefined;
          if (!hasContentPullRequestResult) {
            return;
          }
        }

        if (
          !hasContentPullRequestResult &&
          referenceCompletionTurnId === data.turnId
        ) {
          await channel.thread.post("Saved as a reference.");
          return;
        }

        if (
          !hasContentPullRequestResult &&
          completion?.turnId === data.turnId
        ) {
          await channel.thread.post(
            completion.count === 1
              ? "Saved as a draft."
              : `Saved ${completion.count} drafts.`
          );
          return;
        }

        if (data.message) {
          await postSlackReply(channel, data.message);
        } else {
          await channel.thread.startTyping();
        }
      }),
    "turn.failed": (data, channel, ctx) =>
      runWithSlackTeam(channel.state.installationTeamId, async () => {
        const errorId = getErrorId(data.details);
        logError("Slack agent turn failed", data.message, {
          sessionId: ctx.session.id,
          code: data.code,
          errorId,
        });
        await finishSlackTurnMetrics(
          channel.state,
          ctx.session.id,
          "failed",
          data.code
        );
        await mirrorSessionStatus(ctx, "idle");
        await channel.thread.post(
          withErrorId(SLACK_TURN_FAILED_MESSAGE, errorId)
        );
        await clearSlackWorkingReactions(channel, ctx);
      }),
    "turn.cancelled": (_data, channel, ctx) =>
      runWithSlackTeam(channel.state.installationTeamId, async () => {
        await finishSlackTurnMetrics(
          channel.state,
          ctx.session.id,
          "cancelled"
        );
        await mirrorSessionStatus(ctx, "idle");
        await clearSlackWorkingReactions(channel, ctx);
      }),
    "turn.completed": (_data, channel, ctx) =>
      runWithSlackTeam(channel.state.installationTeamId, async () => {
        await finishSlackTurnMetrics(
          channel.state,
          ctx.session.id,
          "completed"
        );
        await clearSlackWorkingReactions(channel, ctx);
      }),
    // Also covers turns parked on an approval or sign-in.
    "session.waiting": (_data, channel, ctx) =>
      runWithSlackTeam(channel.state.installationTeamId, () =>
        clearSlackWorkingReactions(channel, ctx)
      ),
    "session.failed": (data, channel) =>
      runWithSlackTeam(channel.state.installationTeamId, async () => {
        await clearSlackWorkingReactions(channel);
        const errorId = getErrorId(data.details);
        logError("Slack agent session failed", data.message, {
          code: data.code,
          sessionId: data.sessionId,
          errorId,
        });
        await channel.thread.post(
          withErrorId(SLACK_SESSION_FAILED_MESSAGE, errorId)
        );
      }),
    "reasoning.appended": () => undefined,
    "turn.started": (data, channel, ctx) =>
      runWithSlackTeam(channel.state.installationTeamId, async () => {
        startSlackTurnMetrics(channel.state, data.turnId);
        channel.state.pendingToolCallMessage = null;
        trackSlackWorkingReactions(getNotraSlackState(channel.state), ctx);
        await mirrorSessionStatus(ctx, "working");
      }),
  },
  onAppMention: (ctx, message) => onSlackMessage(ctx, message, "mention"),
  onDirectMessage: (ctx, message) =>
    onSlackMessage(ctx, message, "direct_message"),
  onEvent: onSlackEvent,
  onInputResponse: onSlackInputResponse,
  onInteraction: onSlackInteraction,
  onMessage: onSlackThreadReply,
  threadContext: { since: isLastAgentReply },
});
