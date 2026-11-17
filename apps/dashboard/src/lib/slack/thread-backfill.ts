import {
  getChatSession,
  renameChatSession,
  replaceChatHistory,
} from "@notra/ai/chat/history";
import type { ChatUIMessage } from "@notra/ai/types/chat";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";

import { DEFAULT_CHAT_TITLE } from "@/constants/chat-history";
import {
  SLACK_CHAT_TITLE_PREVIEW_LENGTH,
  SLACK_THREAD_BACKFILL_RETRY_SECONDS,
} from "@/constants/slack-integration";
import { resolveRelayBotToken } from "@/lib/slack/relay";
import { readSlackThread } from "@/lib/slack/thread-reader";
import type { SlackRelayTarget } from "@/types/slack-relay";

const WHITESPACE_REGEX = /\s+/gu;

function retryKey(organizationId: string, chatId: string) {
  return `chat:slack-backfill:${organizationId}:${chatId}`;
}

function slackChatTitle(messages: ChatUIMessage[]): string | null {
  const first = messages.find((message) => message.role === "user");
  const part = first?.parts.find((item) => item.type === "text");
  const text =
    part?.type === "text"
      ? part.text.replace(WHITESPACE_REGEX, " ").trim()
      : "";
  if (!text) {
    return null;
  }
  return text.length > SLACK_CHAT_TITLE_PREVIEW_LENGTH + 3
    ? `Slack: ${text.slice(0, SLACK_CHAT_TITLE_PREVIEW_LENGTH).trimEnd()}...`
    : `Slack: ${text}`;
}

/**
 * Fills a Slack chat that was mirrored without any messages (the agent's
 * first save failed) straight from the Slack thread, so it opens with the
 * conversation instead of an empty notice. Saves only while the chat is still
 * empty; a thread that can't be read is retried after a while, not on every
 * open.
 */
export async function backfillEmptySlackChat(
  organizationId: string,
  chatId: string,
  target: SlackRelayTarget
): Promise<ChatUIMessage[] | null> {
  const key = retryKey(organizationId, chatId);
  if (redis && (await redis.get(key))) {
    return null;
  }
  try {
    const token = await resolveRelayBotToken(target.teamId, organizationId);
    const messages = await readSlackThread(token, target);
    if (!messages?.length) {
      await redis?.set(key, "1", { ex: SLACK_THREAD_BACKFILL_RETRY_SECONDS });
      return null;
    }
    const saved = await replaceChatHistory(
      organizationId,
      chatId,
      messages,
      undefined,
      null
    );
    if (!saved) {
      return null;
    }
    const session = await getChatSession(organizationId, chatId);
    const title = slackChatTitle(messages);
    if (title && session?.title === DEFAULT_CHAT_TITLE) {
      await renameChatSession(organizationId, chatId, title);
    }
    return messages;
  } catch (error) {
    logError("Slack thread backfill failed", error, { organizationId, chatId });
    await redis
      ?.set(key, "1", { ex: SLACK_THREAD_BACKFILL_RETRY_SECONDS })
      .catch(() => undefined);
    return null;
  }
}
