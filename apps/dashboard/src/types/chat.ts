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
  /** Someone in the Slack thread rather than a Notra member. */
  fromSlack?: boolean;
}

export interface ResolveChatMessageAuthorInput {
  metadata: ChatMessageMetadata | undefined;
  membersById: Map<string, ChatMessageAuthor>;
  sessionUser: ClientSessionData["user"] | undefined;
  /** The chat mirrors a Slack thread, so unattributed messages aren't yours. */
  isSlackMirrored?: boolean;
}

/** Where a chat came from, as the sidebar tells them apart. */
export type ChatHistorySource = "dashboard" | "slack";

export type ChatHistorySourceFilter = ChatHistorySource | "all";

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
