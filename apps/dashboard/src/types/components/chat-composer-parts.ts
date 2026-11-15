import type {
  ChatAttachment,
  ContextItem,
  TextSelection,
} from "@notra/ai/types/chat";
import type { ReactNode } from "react";

import type { QueuedMessage } from "@/components/chat/chat-queue";
import type { ChatMessageAuthor } from "@/types/chat";
import type {
  ChatContextOption,
  ChatInputEditingTarget,
} from "@/types/components/chat-input";
import type { PendingChatUpload } from "@/types/hooks/chat-composer-attachments";
import type { SkillSlashOption } from "@/types/skills/slash";

export interface ChatComposerSendButtonProps {
  /** `queued` while a send waits on uploads; clicking cancels it. */
  icon: "send" | "stop" | "queued";
  busy?: boolean;
  disabled: boolean;
  label: string;
  tooltip: string;
  onClick?: () => void;
}

export interface ChatInputErrorProps {
  message: string;
  onRetry?: () => void;
}

export interface ChatComposerNudgeProps {
  /** The host's own chips, shown first. */
  chips?: ReactNode;
  editingTarget?: ChatInputEditingTarget;
  onRetry?: () => void;
  organizationSlug?: string;
  usageLimitError: string | null;
  shouldShowLowCredits: boolean;
  remainingChatCredits: number | null;
  queuedMessages: QueuedMessage[];
  onEditQueued?: (message: QueuedMessage) => void;
  onRemoveQueued?: (id: string) => void;
  onSteerQueued?: (message: QueuedMessage) => void;
  authorsById?: Map<string, ChatMessageAuthor>;
  showAuthorAvatars?: boolean;
  formatQueuedLabel?: (text: string) => string;
  taggedSkills: SkillSlashOption[];
  untagSkill?: (name: string) => void;
  context: ContextItem[];
  onRemoveContext?: (item: ContextItem) => void;
  selection?: TextSelection | null;
  onClearSelection?: () => void;
  attachments: ChatAttachment[];
  pendingUploads: PendingChatUpload[];
  removeAttachment?: (key: string) => void;
  setPreviewAttachment: (attachment: ChatAttachment) => void;
  /** A send is waiting on uploads: what it carries can't change. */
  locked?: boolean;
}

export interface ChatComposerContextPickerProps {
  contextOptions: ChatContextOption[];
  contextPickerId: string;
  disabledReason: string | null;
  isInContext: (item: ContextItem) => boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationSlug?: string;
  toggleContextItem: (item: ContextItem, inContext: boolean) => void;
}
