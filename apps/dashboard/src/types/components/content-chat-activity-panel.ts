import type { IconSvgElement } from "@hugeicons/react";
import type { ChatSessionSummary } from "@notra/ai/types/chat";
import type { ChatStatus, DynamicToolUIPart, ToolUIPart, UIMessage } from "ai";
import type { ReactNode } from "react";

/** Tools a host renders itself, such as a preview of what the agent builds. */
interface ContentChatCustomToolContext {
  isActive: boolean;
  /** Set while the tool waits for the user's approval. */
  onApprove?: () => void;
  onDeny?: () => void;
}

export interface ContentChatCustomTools {
  names: ReadonlySet<string>;
  render: (
    part: ToolUIPart | DynamicToolUIPart,
    context: ContentChatCustomToolContext
  ) => ReactNode;
}

export interface ContentChatActivityConversationProps {
  messages: UIMessage[];
  status: ChatStatus;
  activeChatId: string | null;
  organizationSlug?: string;
  onApproveTool?: (approvalId: string) => void;
  onDenyTool?: (approvalId: string) => void;
  customTools?: ContentChatCustomTools;
  /** Leaves out the model line under each reply. */
  hideModel?: boolean;
}

export interface ContentChatActivityPanelProps extends ContentChatActivityConversationProps {
  title?: string;
  /** Replaces the title, e.g. with tabs when the panel hosts more than the agent. */
  titleSlot?: ReactNode;
  sessions: ChatSessionSummary[];
  isHistoryLoading: boolean;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onClose: () => void;
  onOpenChat?: () => void;
  showHistory?: boolean;
  children?: ReactNode;
}

export interface ContentChatActivityMessageProps {
  message: UIMessage;
  isLoading: boolean;
  elapsedSeconds?: number;
  organizationSlug?: string;
  onApproveTool?: (approvalId: string) => void;
  onDenyTool?: (approvalId: string) => void;
  customTools?: ContentChatCustomTools;
  hideModel?: boolean;
}

export type ContentChatActivityHeaderProps = Pick<
  ContentChatActivityPanelProps,
  | "title"
  | "titleSlot"
  | "sessions"
  | "activeChatId"
  | "isHistoryLoading"
  | "status"
  | "onNewChat"
  | "onSelectChat"
  | "onClose"
  | "onOpenChat"
  | "showHistory"
>;

export type ContentChatHistoryItemsProps = Pick<
  ContentChatActivityPanelProps,
  "sessions" | "activeChatId" | "isHistoryLoading" | "status" | "onSelectChat"
>;

export interface ContentPanelHeaderButtonProps {
  icon: IconSvgElement;
  /** Screen reader name. */
  label: string;
  tooltip: string;
  onClick: () => void;
  pressed?: boolean;
}
