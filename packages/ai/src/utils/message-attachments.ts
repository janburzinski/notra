import {
  MARKDOWN_MEDIA_TYPE,
  PLAIN_TEXT_MEDIA_TYPE,
} from "@notra/ai/constants/media-types";
import { db } from "@notra/db/drizzle";
import { chatAttachments } from "@notra/db/schema";
import type { UIMessage } from "ai";
import { and, eq, inArray } from "drizzle-orm";

type MessagePart = UIMessage["parts"][number];

function normalizeFilePartMediaType(part: MessagePart): MessagePart {
  if (
    part.type === "file" &&
    typeof part.mediaType === "string" &&
    part.mediaType.toLowerCase() === MARKDOWN_MEDIA_TYPE
  ) {
    // Anthropic's "File types and content blocks" section only maps plain text
    // (`text/plain`) to document blocks, so Markdown files are sent as plain
    // text documents while preserving the attachment/document-block flow.
    // https://platform.claude.com/docs/en/build-with-claude/files#file-types-and-content-blocks
    return {
      ...part,
      mediaType: PLAIN_TEXT_MEDIA_TYPE,
    };
  }

  return part;
}

export function normalizeMarkdownFileAttachments<TMessage extends UIMessage>(
  messages: TMessage[]
): TMessage[] {
  return messages.map((message) => ({
    ...message,
    parts: message.parts.map(normalizeFilePartMediaType),
  }));
}

const TRAILING_SLASHES_RE = /\/+$/;
const OBJECT_CHECK_TIMEOUT_MS = 2000;

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
  const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL?.replace(
    TRAILING_SLASHES_RE,
    ""
  );
  if (!publicUrl) {
    return messages;
  }
  const prefix = `${publicUrl}/`;
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
