import { getEvaluationClient } from "@notra/ai/evaluation/client";
import type {
  SlackInboundMessageContext,
  SlackMessage,
  SlackThreadMessage,
} from "eve/channels/slack";

import {
  SLACK_ADDRESSING_CONTEXT_MESSAGES,
  SLACK_ADDRESSING_FEATURE,
  SLACK_ADDRESSING_MESSAGE_MAX_CHARS,
  SLACK_ADDRESSING_QUESTIONS,
  SLACK_ADDRESSING_THRESHOLD,
  SLACK_ADDRESSING_TIMEOUT_MS,
  SLACK_ASSISTANT_NAME,
  SLACK_OTHER_MENTION_PATTERN,
  SLACK_USER_MENTION_PATTERN,
} from "../constants/slack-addressing";

/** Names people "Person 1", "Person 2", … in order of first appearance. */
function createSpeakerNames() {
  const names = new Map<string, string>();
  return (userId: string): string => {
    let name = names.get(userId);
    if (!name) {
      name = `Person ${names.size + 1}`;
      names.set(userId, name);
    }
    return name;
  };
}

function formatText(text: string, nameOf: (userId: string) => string) {
  const readable = text
    .replace(
      SLACK_USER_MENTION_PATTERN,
      (_match, userId: string) => `@${nameOf(userId)}`
    )
    .trim();
  return readable.length > SLACK_ADDRESSING_MESSAGE_MAX_CHARS
    ? `${readable.slice(0, SLACK_ADDRESSING_MESSAGE_MAX_CHARS)}…`
    : readable;
}

function speakerOf(
  message: SlackThreadMessage,
  nameOf: (userId: string) => string
): string {
  if (message.isMe) {
    return SLACK_ASSISTANT_NAME;
  }
  if (message.botId || !message.user) {
    return "Another bot";
  }
  return nameOf(message.user);
}

async function loadEarlierMessages(
  ctx: Pick<SlackInboundMessageContext, "thread">,
  message: SlackMessage
): Promise<SlackThreadMessage[]> {
  await ctx.thread.refresh();
  return ctx.thread.recentMessages
    .filter((item) => item.ts < message.ts)
    .slice(-SLACK_ADDRESSING_CONTEXT_MESSAGES);
}

/** Without the classifier, only replies that name someone else are skipped. */
function isReplyWithoutOtherMention(text: string): boolean {
  return !SLACK_OTHER_MENTION_PATTERN.test(text);
}

/**
 * Decides whether an unmentioned reply in a thread Notra is part of is meant
 * for Notra, so side conversations, thanks and acknowledgements get no answer.
 * Skipped replies still reach the model as thread context on the next turn.
 */
export async function isSlackReplyForAgent(
  ctx: Pick<SlackInboundMessageContext, "thread" | "isBotMentioned">,
  message: SlackMessage,
  organizationId: string
): Promise<boolean> {
  if (ctx.isBotMentioned()) {
    return true;
  }
  const text = message.text.trim();
  if (!text) {
    // Voice clips and files without text keep reaching the agent.
    return message.attachments.length > 0;
  }

  const evaluation = getEvaluationClient();
  if (!evaluation.isAvailable()) {
    return isReplyWithoutOtherMention(text);
  }

  const nameOf = createSpeakerNames();
  const earlier = await loadEarlierMessages(ctx, message);
  const recentThread = earlier
    .map(
      (item) => `${speakerOf(item, nameOf)}: ${formatText(item.text, nameOf)}`
    )
    .join("\n");
  const author = message.author?.userId
    ? nameOf(message.author.userId)
    : "Unknown person";

  const result = await evaluation.tryEvaluate({
    feature: SLACK_ADDRESSING_FEATURE,
    organizationId,
    state: {
      assistantName: SLACK_ASSISTANT_NAME,
      recentThread: recentThread || "(no earlier messages)",
      latestMessage: `${author}: ${formatText(text, nameOf)}`,
    },
    questions: SLACK_ADDRESSING_QUESTIONS,
    timeoutMs: SLACK_ADDRESSING_TIMEOUT_MS,
  });
  if (!result) {
    return isReplyWithoutOtherMention(text);
  }
  return (
    result.answers.addressedToNotra.probability >= SLACK_ADDRESSING_THRESHOLD
  );
}
