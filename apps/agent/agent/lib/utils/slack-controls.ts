import type { SlackInteractionAction } from "eve/channels/slack";

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

  if (control === "leave") {
    await session.reset({ reason: "Slack user opted out of thread replies" });
    await ctx.thread.post(
      "I'll stop replying in this thread. Mention @Notra to start a new conversation."
    );
    return;
  }

  const result = await session.cancel({
    tasks: true,
    ...(value ? { turnId: value.turnId } : {}),
  });
  await ctx.thread.post(
    result.status === "accepted"
      ? "Stop requested. An action already in progress may finish; this doesn't undo saved or published work."
      : "There isn't an active request to stop."
  );
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
