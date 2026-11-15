import type { ChatAttachment } from "@notra/ai/types/chat";
import type { ChangeEvent, DragEvent, RefObject } from "react";

export interface PendingChatUpload {
  id: string;
  filename: string;
}

export interface UseChatComposerAttachmentsResult {
  acceptedFileTypesLabel: string;
  allowedChatMimeTypes: readonly string[];
  attachments: ChatAttachment[];
  attachmentTooltipText: string;
  consumeAttachments: () => ChatAttachment[];
  /** Spread on the drop area; empty when the whole page takes drops. */
  dragHandlers: {
    onDragEnter?: (event: DragEvent<HTMLElement>) => void;
    onDragLeave?: (event: DragEvent<HTMLElement>) => void;
    onDragOver?: (event: DragEvent<HTMLElement>) => void;
    onDrop?: (event: DragEvent<HTMLElement>) => void;
  };
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFilesSelected: (selected: FileList | File[]) => Promise<boolean>;
  handlePasteFiles: (files: File[]) => boolean;
  isDraggingFile: boolean;
  isUploading: boolean;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  pendingUploads: PendingChatUpload[];
  previewAttachment: ChatAttachment | null;
  removeAttachment: (key: string) => void;
  restoreAttachments: (attachments: ChatAttachment[]) => boolean;
  setPreviewAttachment: (attachment: ChatAttachment | null) => void;
  /** Marks what went out as sent and empties the composer's files. */
  submitAttachments: (sent: ChatAttachment[]) => void;
  /** The uploads a waiting send needs, or null when one of them failed. */
  takeCompletedUploads: (ids: readonly string[]) => ChatAttachment[] | null;
}
