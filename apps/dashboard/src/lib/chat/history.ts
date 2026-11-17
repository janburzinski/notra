import {
  getActiveChatStream,
  getChatHistorySnapshot,
  getLastResponseStopped,
} from "@notra/ai/chat/history";
import { hydrateSavedChatPosts } from "@notra/ai/chat/posts";
import type { ChatUIMessage } from "@notra/ai/types/chat";

import {
  getSlackThreadPermalink,
  parseSlackExternalChannelKey,
} from "@/lib/slack/relay";
import { backfillEmptySlackChat } from "@/lib/slack/thread-backfill";

/** Returns null when the chat was deleted. */
export async function loadChatHistoryPayload(
  organizationId: string,
  chatId: string
) {
  const [snapshot, lastResponseStopped, activeStreamId] = await Promise.all([
    getChatHistorySnapshot<ChatUIMessage>(organizationId, chatId),
    getLastResponseStopped(organizationId, chatId),
    getActiveChatStream(organizationId, chatId),
  ]);
  if (!snapshot) {
    return null;
  }
  const { externalChannelId } = snapshot;
  const target =
    externalChannelId?.source === "slack" && externalChannelId.id
      ? parseSlackExternalChannelKey(externalChannelId.id)
      : null;
  // A Slack chat whose first save failed is filled from the thread itself.
  const messages =
    target && snapshot.messages.length === 0
      ? ((await backfillEmptySlackChat(organizationId, chatId, target)) ??
        snapshot.messages)
      : snapshot.messages;
  const [hydratedMessages, slackThreadUrl] = await Promise.all([
    hydrateSavedChatPosts(organizationId, chatId, messages),
    target ? getSlackThreadPermalink(target, organizationId) : null,
  ]);

  return {
    chatId,
    messages: hydratedMessages,
    lastResponseStopped,
    activeStreamId,
    externalChannelId,
    slackThreadUrl,
  };
}
