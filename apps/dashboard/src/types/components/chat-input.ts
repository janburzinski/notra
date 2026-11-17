import type {
  ChatAttachment,
  ChatInputHandle,
  ContextItem,
  TextSelection,
  ThinkingLevel,
} from "@notra/ai/types/chat";
import type { ReactNode, Ref } from "react";

import type { QueuedMessage } from "@/components/chat/chat-queue";
import type { ChatMessageAuthor } from "@/types/chat";
import type { ChatComposerApproval } from "@/types/chat-approval";
import type { ChatPostMention } from "@/types/chat-posts";
import type { GitHubRepository } from "@/types/integrations";

export interface ChatComposerHandle extends ChatInputHandle {
  /** The content page mounts a floating and a panel composer; only one shows. */
  isVisible: () => boolean;
}

export interface ChatInputEditingTarget {
  title: string;
  description: string;
}

export interface ChatInputProps {
  ref?: Ref<ChatComposerHandle>;
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
  /** `card` draws the pill in the table card colours, for a grey panel shell. */
  surface?: "default" | "card";
  /** Text the composer starts with, e.g. from a `?q=` link. */
  initialValue?: string;
  /** A stop is on its way; the send button waits for it. */
  isStopping?: boolean;
  /** Queued messages show who wrote them in a shared chat. */
  authorsById?: Map<string, ChatMessageAuthor>;
  showAuthorAvatars?: boolean;
  onEmptyChange?: (isEmpty: boolean) => void;
  /** Keeps an unsent draft, with its context and skills, under this key. */
  draftStorageKey?: string;
  /** Posts of this chat the @ menu offers. */
  postMentions?: readonly ChatPostMention[];
  /** `document` attaches files dropped anywhere on the page. */
  dropZone?: "element" | "document";
  /** A tool waiting on you; the composer asks about it above the input. */
  approval?: ChatComposerApproval | null;
  /** Off where files make no sense: no attach button, drop or file paste. */
  attachments?: boolean;
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
