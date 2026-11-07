import type {
  ChatMessageMetadata,
  ChatSessionSummary,
} from "@notra/ai/types/chat";

import type { ClientSessionData } from "@/types/auth/session";

export interface ChatMessageAuthor {
  id: string;
  name: string | null;
  image: string | null;
  seed: string;
}

export interface ResolveChatMessageAuthorInput {
  metadata: ChatMessageMetadata | undefined;
  membersById: Map<string, ChatMessageAuthor>;
  sessionUser: ClientSessionData["user"] | undefined;
}

export type ChatHistoryGroupId =
  | "today"
  | "yesterday"
  | "last7Days"
  | "lastMonth"
  | "older";

export interface ChatHistoryGroup {
  id: ChatHistoryGroupId;
  sessions: ChatSessionSummary[];
}

export type ChatSuggestionSignal =
  | { kind: "draft"; postId: string; title: string; updatedAt: string }
  | { kind: "gap"; title: string; prompt: string; competitor: string | null }
  | { kind: "repo"; owner: string; repo: string }
  | { kind: "shipped"; feedbackId: string; title: string; resolvedAt: string };

export interface ChatSuggestionSignals {
  brandName: string | null;
  hasGeo: boolean;
  signals: ChatSuggestionSignal[];
}
