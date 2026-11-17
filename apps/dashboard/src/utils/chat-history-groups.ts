import type { ChatSessionSummary } from "@notra/ai/types/chat";

import {
  CHAT_HISTORY_SOURCES,
  DEFAULT_CHAT_TITLE,
} from "@/constants/chat-history";
import type { ChatHistorySource, ChatHistorySourceFilter } from "@/types/chat";

export function chatSessionSource(
  session: ChatSessionSummary
): ChatHistorySource {
  // Ask agent and API-linked chats are regular chats here; only Slack
  // threads are marked.
  return session.externalChannelId?.source === "slack" ? "slack" : "dashboard";
}

/** The sources present in the list, in a stable order, for the filter menu. */
export function chatSessionSources(
  sessions: ChatSessionSummary[]
): ChatHistorySource[] {
  const present = new Set(sessions.map(chatSessionSource));
  return CHAT_HISTORY_SOURCES.filter((source) => present.has(source));
}

export function filterChatSessions(
  sessions: ChatSessionSummary[],
  {
    source,
    query,
    newChatLabel,
  }: {
    source: ChatHistorySourceFilter;
    query: string;
    newChatLabel: string;
  }
): ChatSessionSummary[] {
  const needle = query.trim().toLocaleLowerCase();
  const visible = sessions.filter((session) => {
    if (source !== "all" && chatSessionSource(session) !== source) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return displayChatTitle(session.title, newChatLabel)
      .toLocaleLowerCase()
      .includes(needle);
  });
  // Pinned chats stay on top, but each row shows when it was last active, so
  // both halves read newest first rather than in the order they were pinned.
  return visible.sort(
    (left, right) =>
      Number(Boolean(right.pinnedAt)) - Number(Boolean(left.pinnedAt)) ||
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );
}

export function mergePendingChatSessions(
  sessions: ChatSessionSummary[],
  pendingSessions: ChatSessionSummary[]
): ChatSessionSummary[] {
  const stillPending = excludeArrivedPendingSessions(pendingSessions, sessions);
  if (stillPending.length === 0) {
    return sessions;
  }

  return [...stillPending, ...sessions];
}

export function excludeArrivedPendingSessions(
  pendingSessions: ChatSessionSummary[],
  sessions: ChatSessionSummary[]
): ChatSessionSummary[] {
  if (pendingSessions.length === 0) {
    return pendingSessions;
  }

  const existingIds = new Set(sessions.map((session) => session.chatId));
  return pendingSessions.filter((session) => !existingIds.has(session.chatId));
}

export function excludeArrivedGeneratingIds(
  generatingIds: string[],
  sessions: ChatSessionSummary[]
): string[] {
  if (generatingIds.length === 0) {
    return generatingIds;
  }

  const existingIds = new Set(sessions.map((session) => session.chatId));
  return generatingIds.filter((id) => !existingIds.has(id));
}

export function displayChatTitle(title: string, newChatLabel: string): string {
  return title === DEFAULT_CHAT_TITLE ? newChatLabel : title;
}
