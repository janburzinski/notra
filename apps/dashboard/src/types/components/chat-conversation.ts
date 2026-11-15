import type { ChatStatus, DynamicToolUIPart, ToolUIPart, UIMessage } from "ai";
import type { ReactNode } from "react";

import type { McpIconUrls } from "@/types/integrations/mcp";

export type ChatToolPart = ToolUIPart | DynamicToolUIPart;

type ChatMessagePart = UIMessage["parts"][number];

interface ChatCustomToolContext {
  messageId: string;
  /** The reply this tool belongs to is still being written. */
  isActive: boolean;
  /** The reply shows its work log, which already says it is working. */
  hasInlineActivity: boolean;
  /** Set while the tool waits for the user's approval. */
  onApprove?: () => void;
  onDeny?: () => void;
}

/** Tools a host renders itself, such as a preview of what the agent builds. */
export interface ChatCustomTools {
  names: ReadonlySet<string>;
  render: (part: ChatToolPart, context: ChatCustomToolContext) => ReactNode;
}

export interface ChatAttachmentPreview {
  url: string;
  filename: string;
  mediaType: string;
}

export interface ChatContentPartOptions {
  isAnimating?: boolean;
  mcpLogosByConnectionId?: ReadonlyMap<string, McpIconUrls>;
  postTitlesById?: ReadonlyMap<string, string>;
  onPreviewAttachment: (attachment: ChatAttachmentPreview) => void;
}

/** Draws a text, file or reasoning part the way the conversation does. */
type ChatRenderContentPart = (part: ChatMessagePart, key: string) => ReactNode;

export interface ChatConversationProps {
  messages: UIMessage[];
  status: ChatStatus;
  /** Counts as writing even when `status` doesn't, e.g. a Slack-mirrored reply. */
  isWorking?: boolean;
  activeChatId: string | null;
  organizationId?: string;
  organizationSlug?: string;
  onApproveTool?: (approvalId: string, part: ChatToolPart) => void;
  onDenyTool?: (approvalId: string, part: ChatToolPart) => void;
  customTools?: ChatCustomTools;
  /** Opens a saved artifact; without it the card opens the artifact's page. */
  onOpenArtifact?: (artifactId: string) => void;
  mcpLogosByConnectionId?: ReadonlyMap<string, McpIconUrls>;
  postTitlesById?: ReadonlyMap<string, string>;
  /** `shell` puts the conversation on a card inside the tables' dualtone frame. */
  surface?: "muted" | "shell";
  /** `page` is the full chat page; `panel` the narrower side panels and docks. */
  layout?: "page" | "panel";
  /** The last reply was stopped by the user, so its plan shows where it ended. */
  wasStoppedByUser?: boolean;
  /** A stop is on its way: the status says so instead of "Thinking". */
  isStopping?: boolean;
  /** Replaces the default user message, e.g. with editing and branches. */
  renderUserMessage?: (
    message: UIMessage,
    index: number,
    renderPart: ChatRenderContentPart
  ) => ReactNode;
  /** Key and class for a message's row, e.g. to replay its entrance. */
  getMessageKey?: (message: UIMessage, index: number) => string;
  getMessageClassName?: (
    message: UIMessage,
    index: number
  ) => string | false | undefined;
  /** After the last message: stop and error notices. */
  notices?: ReactNode;
  /** Over the chat column, centered on it: the page's minimap. */
  overlay?: ReactNode;
  /** Hides a standalone tool's row while keeping it mounted. */
  isStandalonePartVisible?: (content: ReactNode) => boolean;
  /** Approvals the composer asks about; their rows here get no buttons. */
  isApprovalInComposer?: (part: ChatToolPart) => boolean;
}

export interface ChatAssistantMessageProps extends Pick<
  ChatConversationProps,
  | "organizationId"
  | "organizationSlug"
  | "onApproveTool"
  | "onDenyTool"
  | "customTools"
  | "mcpLogosByConnectionId"
  | "postTitlesById"
  | "isStandalonePartVisible"
  | "isApprovalInComposer"
> {
  message: UIMessage;
  /** The reply is being written, so its work log stays open. */
  isLoading: boolean;
  /** The reply is the one the agent is working on right now. */
  isActive: boolean;
  hasInlineActivity: boolean;
  /** Undefined reads a stop from the plan itself. */
  isStopped?: boolean;
  elapsedSeconds?: number;
  onOpenArtifact: (artifactId: string) => void;
  onPreviewAttachment: (attachment: ChatAttachmentPreview) => void;
}

export interface ChatUserMessageProps {
  message: UIMessage;
  surface: "muted" | "shell";
  onPreviewAttachment: (attachment: ChatAttachmentPreview) => void;
}
