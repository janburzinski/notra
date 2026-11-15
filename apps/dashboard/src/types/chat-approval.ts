import type { ChatToolPart } from "@/types/components/chat-conversation";

export interface ChatApprovalInputChip {
  key: string;
  label: string;
  value: string;
}

/** A tool call the composer asks you to allow. */
export interface ChatComposerApproval {
  part: ChatToolPart;
  onAllowOnce: () => void;
  /** Allows it, and every later call of this tool in the chat. */
  onAllowForChat: () => void;
  onDeny: () => void;
}

/** The answer picked in the approval card: allow once, for the chat, or your own words. */
export type ChatApprovalChoice = "once" | "chat" | "reply";

export interface ChatApprovalCardProps {
  approval: ChatComposerApproval;
  /** Denies the call and sends your words instead; false when it can't send. */
  onReply: (text: string) => boolean;
}
