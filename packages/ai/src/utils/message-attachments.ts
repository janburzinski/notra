import {
  MARKDOWN_MEDIA_TYPE,
  PLAIN_TEXT_MEDIA_TYPE,
} from "@notra/ai/constants/media-types";
import { db } from "@notra/db/drizzle";
import { chatAttachments } from "@notra/db/schema";
import type { UIMessage } from "ai";
import { and, eq, inArray } from "drizzle-orm";

const TRAILING_SLASHES_RE = /\/+$/;
const OBJECT_CHECK_TIMEOUT_MS = 2000;

type MessagePart = UIMessage["parts"][number];
type FilePart = Extract<MessagePart, { type: "file" }>;

const TEXT_MEDIA_TYPES = new Set([MARKDOWN_MEDIA_TYPE, PLAIN_TEXT_MEDIA_TYPE]);
const IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function isImagePart(part: MessagePart): part is FilePart {
  return (
    part.type === "file" && IMAGE_MEDIA_TYPES.has(part.mediaType.toLowerCase())
  );
}

const INLINE_ATTACHMENT_MAX_CHARS = 100_000;
// About 75k tokens across the conversation, leaving room for the prompt and
// history on hosts with the smallest GLM context window.
const INLINE_ATTACHMENTS_TOTAL_MAX_CHARS = 300_000;
const INLINE_ATTACHMENT_TIMEOUT_MS = 10_000;

function getStoragePrefix(): string | null {
  const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL?.replace(
    TRAILING_SLASHES_RE,
    ""
  );
  return publicUrl ? `${publicUrl}/` : null;
}

/** Streams the file and stops at `maxChars`, so large uploads are never buffered whole. */
async function readTextPrefix(
  url: string,
  maxChars: number,
  abortSignal?: AbortSignal
): Promise<{ text: string; truncated: boolean } | null> {
  const timeout = AbortSignal.timeout(INLINE_ATTACHMENT_TIMEOUT_MS);
  const response = await fetch(url, {
    signal: abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout,
  }).catch(() => null);
  if (!(response?.ok && response.body)) {
    return null;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return { text: text + decoder.decode(), truncated: false };
      }
      text += decoder.decode(value, { stream: true });
      if (text.length > maxChars) {
        return { text: text.slice(0, maxChars), truncated: true };
      }
    }
  } catch {
    return null;
  } finally {
    reader.cancel().catch(() => undefined);
  }
}

async function attachmentToText(
  part: FilePart,
  prefix: string | null,
  budget: number,
  abortSignal?: AbortSignal
): Promise<string> {
  const name = part.filename ?? "file";
  const mediaType = part.mediaType.toLowerCase();
  if (
    !(prefix && part.url.startsWith(prefix) && TEXT_MEDIA_TYPES.has(mediaType))
  ) {
    return `[Attachment "${name}" (${mediaType}) was not sent: this chat can only read images, text and Markdown files]`;
  }
  if (budget <= 0) {
    return `[Attachment "${name}" was not sent: the chat's attachment text limit is reached]`;
  }
  const read = await readTextPrefix(
    part.url,
    Math.min(INLINE_ATTACHMENT_MAX_CHARS, budget),
    abortSignal
  );
  if (!read) {
    return `[Attachment "${name}" could not be read]`;
  }
  return `Attachment "${name}":\n\n${read.text}${read.truncated ? "\n\n[Attachment truncated]" : ""}`;
}

/**
 * GLM's chat-completions API takes images but no other file parts. Images
 * pass through, uploaded text and Markdown files are inlined as text and
 * anything else, such as PDFs from older chats, becomes a short note.
 * Attachments are read one at a time, newest message first, so the latest
 * files get the conversation's text budget.
 */
export async function prepareChatFileAttachments<TMessage extends UIMessage>(
  messages: TMessage[],
  abortSignal?: AbortSignal
): Promise<TMessage[]> {
  const prefix = getStoragePrefix();
  let budget = INLINE_ATTACHMENTS_TOTAL_MAX_CHARS;
  const prepared: TMessage[] = [];
  for (const message of messages.toReversed()) {
    const parts: MessagePart[] = [];
    for (const part of message.parts) {
      if (part.type !== "file" || isImagePart(part)) {
        parts.push(part);
        continue;
      }
      // Sequential on purpose: bounds memory and spends the budget in order.
      const text = await attachmentToText(part, prefix, budget, abortSignal);
      budget -= text.length;
      parts.push({ type: "text", text });
    }
    prepared.push({ ...message, parts });
  }
  return prepared.reverse();
}

async function isMissingObject(url: string, abortSignal?: AbortSignal) {
  const timeout = AbortSignal.timeout(OBJECT_CHECK_TIMEOUT_MS);
  const response = await fetch(url, {
    method: "HEAD",
    signal: abortSignal ? AbortSignal.any([abortSignal, timeout]) : timeout,
  }).catch(() => null);
  return response?.status === 404;
}

/**
 * Replaces uploaded attachments whose object no longer exists (deleted from
 * the attachments page or with the uploader's account) with a short note, so
 * the provider doesn't fail the turn fetching them. A recorded row means the
 * object exists: rows are removed before or with their objects. Only uploads
 * without a row (whose recording failed or that were deleted) are checked in
 * storage, each with a short deadline; a slow or failed check keeps the part.
 */
export async function replaceMissingFileAttachments<TMessage extends UIMessage>(
  organizationId: string,
  messages: TMessage[],
  abortSignal?: AbortSignal
): Promise<TMessage[]> {
  const prefix = getStoragePrefix();
  if (!prefix) {
    return messages;
  }
  const keysByUrl = new Map<string, string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "file" && part.url.startsWith(prefix)) {
        keysByUrl.set(part.url, part.url.slice(prefix.length));
      }
    }
  }
  if (keysByUrl.size === 0) {
    return messages;
  }

  const recorded = await db
    .select({ key: chatAttachments.key })
    .from(chatAttachments)
    .where(
      and(
        eq(chatAttachments.organizationId, organizationId),
        inArray(chatAttachments.key, [...keysByUrl.values()])
      )
    );
  const recordedKeys = new Set(recorded.map((row) => row.key));
  const missing = new Set<string>();
  await Promise.all(
    [...keysByUrl]
      .filter(([, key]) => !recordedKeys.has(key))
      .map(async ([url]) => {
        if (await isMissingObject(url, abortSignal)) {
          missing.add(url);
        }
      })
  );
  if (missing.size === 0) {
    return messages;
  }
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map((part): MessagePart =>
      part.type === "file" && missing.has(part.url)
        ? {
            type: "text",
            text: `[Attachment "${part.filename ?? "file"}" is no longer available]`,
          }
        : part
    ),
  }));
}
