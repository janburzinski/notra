import type {
  ChatMessagePart,
  ChatUIMessage,
  ContextItem,
  ThinkingLevel,
} from "@notra/ai/types/chat";
import type { RefObject } from "react";

import type { ChatComposerHandle } from "@/types/components/chat-input";

/** The Autopilot page the user is on, so "this" means it. */
export interface AgentChatFocus {
  autopilotWorkflowId?: string;
  autopilotAutomation?: string;
}

export interface UseAgentChatOptions {
  organizationId: string;
  /** A saved chat to continue; without it the hook starts a new one. */
  initialChatId?: string;
  projectId: string | null;
  thinkingLevel: ThinkingLevel;
  /** Integrations picked in the composer; sent once the user changed them. */
  context?: ContextItem[];
  hasCustomizedContext?: boolean;
  focus?: AgentChatFocus;
  /** The composer, for taking a queued message back to edit it. */
  chatInputRef?: RefObject<ChatComposerHandle | null>;
  /** Who sends, kept on each message and queued message. */
  authorUserId?: string;
  /** Keeps queued messages across reloads, per chat and user. */
  persistQueue?: boolean;
  /** Holds every send, such as while the project resolves. */
  canSend?: boolean;
  /** The chat runs elsewhere (Slack), so nothing here sends or drains. */
  paused?: boolean;
  /** Shown when a request fails for no reason the user can act on. */
  fallbackError?: string;
  /** Runs right before a message goes out. */
  onBeforeSend?: (send: {
    chatId: string;
    isEmptyChat: boolean;
    isFirstInNewChat: boolean;
  }) => void;
  /** The server saved a new chat. */
  onChatCreated?: (chatId: string) => void;
  /** A new chat's first reply settled with nothing queued behind it. */
  onNewChatReplied?: (reply: {
    chatId: string;
    message: ChatUIMessage;
    messages: ChatUIMessage[];
    wasStoppedByUser: boolean;
  }) => void;
  /** A request failed and wasn't put back in the queue. */
  onError?: (chatId: string) => void;
}

export type AgentChatResend = (
  userMessageId: string,
  text: string,
  attachments: ChatMessagePart[]
) => Promise<void>;
