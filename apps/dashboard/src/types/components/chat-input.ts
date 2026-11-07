import type {
  ChatAttachment,
  ChatInputHandle,
  ContextItem,
  TextSelection,
  ThinkingLevel,
} from "@notra/ai/types/chat";
import type { ReactNode, Ref } from "react";

import type { QueuedMessage } from "@/components/chat/chat-queue";
import type { ChatPostMention } from "@/types/chat-posts";
import type { PendingChatUpload } from "@/types/hooks/chat-composer-attachments";
import type { UseContentChatInputResult } from "@/types/hooks/content-chat-input";
import type { GitHubRepository } from "@/types/integrations";
import type { SkillSlashOption } from "@/types/skills/slash";

export type ContentChatInputHandle = Pick<
  ChatInputHandle,
  "setAttachments" | "focus"
> & {
  /** The content page mounts a floating and a panel composer; only one shows. */
  isVisible: () => boolean;
};

export interface ChatInputEditingTarget {
  title: string;
  description: string;
}

export interface ChatInputProps {
  ref?: Ref<ContentChatInputHandle>;
  onSend?: (value: string, attachments: ChatAttachment[]) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  selection?: TextSelection | null;
  onClearSelection?: () => void;
  organizationSlug?: string;
  organizationId?: string;
  context?: ContextItem[];
  onAddContext?: (item: ContextItem) => void;
  onRemoveContext?: (item: ContextItem) => void;
  value?: string;
  onValueChange?: (value: string) => void;
  error?: string | null;
  onClearError?: () => void;
  /** Shown next to the error, to send the message that failed again. */
  onRetry?: () => void;
  /** Chips the host attaches, such as the workflow the agent talks about. */
  chips?: ReactNode;
  connectedTop?: boolean;
  placeholder?: string;
  editingTarget?: ChatInputEditingTarget;
  queuedMessages?: QueuedMessage[];
  onEditQueued?: (message: QueuedMessage) => void;
  onRemoveQueued?: (id: string) => void;
  onSteerQueued?: (message: QueuedMessage) => void;
  effort?: Omit<ChatEffortMenuProps, "disabled">;
  /** `pill` is a single-line floating composer with attach and send only. */
  layout?: "card" | "pill";
  /** Keeps the pill on two rows, such as while a conversation sits above it. */
  pillExpanded?: boolean;
  /** Lifts the pill off the page with a shadow; on by default for pills. */
  elevated?: boolean;
}

export interface ChatEffortMenuProps {
  disabled?: boolean;
  onThinkingLevelChange: (level: ThinkingLevel) => void;
  thinkingLevel: ThinkingLevel;
}

export type EnabledRepo = GitHubRepository & { integrationId: string };

export interface EnabledLinear {
  id: string;
  displayName: string;
  integrationId: string;
  teamName?: string | null;
}

export interface ChatInputContextRowProps {
  context: ContextItem[];
  selection?: TextSelection | null;
  onRemoveContext?: (item: ContextItem) => void;
  onClearSelection?: () => void;
}

type ChatContextOptionKind = "github" | "linear" | "mcp";

export interface ChatContextOption {
  id: string;
  kind: ChatContextOptionKind;
  label: string;
  description: string;
  searchText: string;
  contextItem: ContextItem;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
}

interface ChatPostMentionOption {
  id: string;
  kind: "post";
  label: string;
  searchText: string;
  post: ChatPostMention;
}

export type ChatMentionOption = ChatContextOption | ChatPostMentionOption;

export interface ChatInputContextPickerProps {
  contextOptions: ChatContextOption[];
  contextPickerId: string;
  disabledReason: string | null;
  isInContext: (item: ContextItem) => boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug?: string;
  toggleContextItem: (item: ContextItem, inContext: boolean) => void;
}

export interface ChatInputComposerNudgeProps {
  chips?: ReactNode;
  onRetry?: () => void;
  attachments: ChatAttachment[];
  context: ContextItem[];
  editingTarget?: ChatInputEditingTarget;
  hasAttachmentChips: boolean;
  hasContextChips: boolean;
  onClearSelection?: () => void;
  onEditQueued?: (message: QueuedMessage) => void;
  onRemoveContext?: (item: ContextItem) => void;
  onRemoveQueued?: (id: string) => void;
  onSteerQueued?: (message: QueuedMessage) => void;
  organizationSlug?: string;
  pendingUploads: PendingChatUpload[];
  queuedMessages: QueuedMessage[];
  remainingChatCredits: number | null;
  removeAttachment: (key: string) => void;
  selection?: TextSelection | null;
  setPreviewAttachment: (attachment: ChatAttachment) => void;
  shouldShowLowCredits: boolean;
  taggedSkills: SkillSlashOption[];
  untagSkill: (name: string) => void;
  usageLimitError: string | null;
}

export interface ChatContextOptionContentProps {
  option: ChatContextOption;
}

export type ChatContextSuggestedIntegrationId = "github" | "linear" | "mcp";

export interface ChatContextSuggestedIntegration {
  id: ChatContextSuggestedIntegrationId;
  name: string;
  href: string;
  keywords: readonly string[];
}

export interface ChatContextConnectSuggestionsProps {
  organizationSlug: string;
  onSelect: () => void;
}

export interface ChatFileAttachmentProps {
  url: string;
  filename?: string;
  mediaType?: string;
}

export interface ChatInputErrorProps {
  message: string;
  onRetry?: () => void;
}

export interface ChatComposerTextareaProps {
  input: UseContentChatInputResult;
  pill: boolean;
  slashListId: string;
  /** Set while editing a post, to describe what the message edits. */
  editingTargetId?: string;
}

export interface ChatComposerSendButtonProps {
  input: UseContentChatInputResult;
}

export interface PillComposerBodyProps {
  /** Two rows while you write, one otherwise. */
  open: boolean;
  attachButton: ReactNode;
  textarea: ReactNode;
  sendButton: ReactNode;
}

export interface CardComposerToolbarProps {
  input: UseContentChatInputResult;
  onAddContext: ChatInputProps["onAddContext"];
  effort: ChatInputProps["effort"];
  attachButton: ReactNode;
  sendButton: ReactNode;
}
