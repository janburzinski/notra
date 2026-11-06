import {
  ALLOWED_CHAT_MIME_TYPES,
  MIME_DISPLAY_LABELS,
} from "@notra/schemas/constants/dashboard/upload";
import { IMAGE_MIME_EXTENSIONS } from "@notra/sites-core/constants/uploads";

const MIME_EXTENSION_MAP: Record<string, string> = {
  ...IMAGE_MIME_EXTENSIONS,
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function getFileExtension(fileType: string) {
  const normalizedMimeType = fileType.split(";")[0]?.trim().toLowerCase();
  if (!normalizedMimeType) {
    return "bin";
  }

  return MIME_EXTENSION_MAP[normalizedMimeType] ?? "bin";
}

const HEIC_FILE_RE = /\.heic$/i;

export const CHAT_FILE_TYPES_LABEL = [
  ...new Set(ALLOWED_CHAT_MIME_TYPES.map((mime) => MIME_DISPLAY_LABELS[mime])),
].join(", ");

export function isAllowedChatMimeType(fileType: string) {
  return (ALLOWED_CHAT_MIME_TYPES as readonly string[]).includes(fileType);
}

export function isHeicFile(file: File) {
  return HEIC_FILE_RE.test(file.name) || file.type === "image/heic";
}

export function isImageMimeType(mediaType: string): boolean {
  return mediaType.startsWith("image/");
}

export function isPdfMimeType(mediaType: string): boolean {
  return mediaType === "application/pdf";
}

export function isTextMimeType(mediaType: string): boolean {
  return mediaType === "text/plain" || mediaType === "text/markdown";
}
