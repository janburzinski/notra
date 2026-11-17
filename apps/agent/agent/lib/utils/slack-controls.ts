import type { SlackInteractionAction } from "eve/channels/slack";
import { SessionNotActiveError } from "eve/sessions";

import {
  SLACK_CONTROL_MENTION_REGEX,
  SLACK_LEAVE_ACTION_ID,
  SLACK_LEAVE_MESSAGES,
  SLACK_STOP_ACTION_ID,
  SLACK_STOP_MESSAGES,
} from "../constants/slack-controls";
import { slackControlValueSchema } from "../schemas/slack-controls";
import type {
  SlackControl,
  SlackControlContext,
  SlackControlValue,
} from "../types/slack-controls";

export function parseSlackControlMessage(
  text: string,
  botMentioned = false
): SlackControl | null {
  if (SLACK_CONTROL_MENTION_REGEX.test(text.trim()) && !botMentioned) {
    return null;
  }
  const command = text
    .trim()
    .replace(SLACK_CONTROL_MENTION_REGEX, "")
    .replace(/[.!]+$/u, "")
    .trim()
    .toLowerCase();

  if (SLACK_LEAVE_MESSAGES.has(command)) {
    return "leave";
  }
  return SLACK_STOP_MESSAGES.has(command) ? "stop" : null;
}

// How long "stop" waits to learn whether a turn was running, as eve's own
// code-channel stop does.
const CANCEL_RESULT_TIMEOUT_MS = 10_000;

export async function handleSlackControl(
  control: SlackControl,
  ctx: SlackControlContext,
  value?: SlackControlValue
): Promise<void> {
  const session = await ctx.resolveSession();
  if (!session || (value && value.sessionId !== session.id)) {
    await ctx.thread.post("This conversation is no longer active.");
    return;
  }

  try {
    if (control === "leave") {
      await session.end({ reason: "Slack user opted out of thread replies" });
      await ctx.thread.post(
        "I'll stop replying in this thread. Mention @Notra to start a new conversation."
      );
      return;
    }

    // Without a turn guard the cancel also stops the session's working tasks.
    const delivery = await session.cancel(
      value ? { turnId: value.turnId } : undefined
    );
    const result = await delivery
      .result({ signal: AbortSignal.timeout(CANCEL_RESULT_TIMEOUT_MS) })
      .catch(() => null);
    await ctx.thread.post(
      result?.outcome === "ignored"
        ? "There isn't an active request to stop."
        : "Stop requested. An action already in progress may finish; this doesn't undo saved or published work."
    );
  } catch (error) {
    if (!(error instanceof SessionNotActiveError)) {
      throw error;
    }
    await ctx.thread.post("This conversation is no longer active.");
  }
}

export async function handleSlackControlAction(
  action: SlackInteractionAction,
  ctx: SlackControlContext
): Promise<void> {
  if (
    action.actionId !== SLACK_STOP_ACTION_ID &&
    action.actionId !== SLACK_LEAVE_ACTION_ID
  ) {
    return;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(action.value ?? "");
  } catch {
    return;
  }
  const value = slackControlValueSchema.safeParse(raw);
  if (!value.success) {
    return;
  }
  await handleSlackControl(
    action.actionId === SLACK_LEAVE_ACTION_ID ? "leave" : "stop",
    ctx,
    value.data
  );
}
