import type { ChatAttachment } from "@notra/ai/types/chat";

import type { PendingChatUpload } from "@/types/hooks/chat-composer-attachments";

export interface ChatComposerAttachButtonProps {
  attachmentCount: number;
  disabled: boolean;
  onAttach: () => void;
  pendingUploadCount: number;
  tooltip: string;
  /** Round and filled, as on the floating pill. */
  filled?: boolean;
}

export interface ChatComposerDropOverlayProps {
  acceptedFileTypesLabel: string;
}

export interface ChatComposerAttachmentChipsProps {
  attachments: ChatAttachment[];
  pendingUploads: PendingChatUpload[];
  removeAttachment: (key: string) => void;
  setPreviewAttachment: (attachment: ChatAttachment) => void;
}
