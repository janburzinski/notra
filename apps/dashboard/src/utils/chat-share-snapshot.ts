import type { ChatUIMessage } from "@notra/ai/types/chat";
import type {
  SharedChatMessage,
  SharedChatPartContent,
} from "@notra/db/types/chat-shares";
import { getToolName, isToolUIPart } from "ai";

import {
  CHAT_REFERENCE_TOKEN_SPLIT_REGEX,
  UPDATE_TODOS_TOOL_NAME,
} from "@/constants/chat-posts";
import { parseChatAnnotations } from "@/utils/chat-annotations";
import {
  getChatPosts,
  getCreateToolContentType,
  parsePostReferenceValue,
} from "@/utils/chat-posts";
import {
  getReferenceDisplay,
  parseReferenceValue,
} from "@/utils/integration-reference";

const LINE_BREAK_REGEX = /\r?\n/;

function quote(text: string) {
  return text
    .split(LINE_BREAK_REGEX)
    .map((line) => `> ${line}`)
    .join("\n");
}

/**
 * Turns composer-only syntax into readable text: annotation blocks become
 * quotes, and integration and post tokens become their labels so internal
 * ids never reach a public page.
 */
function toShareText(raw: string, postTitles: ReadonlyMap<string, string>) {
  const labelTokens = (text: string) =>
    text.replace(CHAT_REFERENCE_TOKEN_SPLIT_REGEX, (match) => {
      const postId = parsePostReferenceValue(match);
      if (postId) {
        return `@${postTitles.get(postId) ?? "post"}`;
      }
      const item = parseReferenceValue(match);
      return item ? getReferenceDisplay(item) : match;
    });
  const annotated = parseChatAnnotations(raw);
  const quotes = annotated
    ? annotated.annotations.map((annotation) => {
        const passage = quote(labelTokens(annotation.text));
        return annotation.note
          ? `${passage}\n\n${labelTokens(annotation.note)}`
          : passage;
      })
    : [];
  const body = labelTokens(annotated ? annotated.rest : raw);
  return [...quotes, body.trim()].filter(Boolean).join("\n\n");
}

/**
 * Builds the public copy of a chat. Only what a reader needs survives:
 * message text, attachment names without URLs, saved posts, and the names of
 * the tools that ran. Tool inputs and outputs, reasoning, authors, and model
 * metadata and message ids are dropped because they can carry workspace data.
 */
export function buildChatShareSnapshot(
  messages: readonly ChatUIMessage[]
): SharedChatMessage[] {
  const posts = getChatPosts(messages);
  const postsByToolCallId = new Map(
    posts.flatMap((post) =>
      post.state === "saved" ? [[post.toolCallId, post] as const] : []
    )
  );
  const postTitles = new Map(
    posts.flatMap((post) =>
      post.postId && post.title ? [[post.postId, post.title] as const] : []
    )
  );

  return messages.flatMap((message, position): SharedChatMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") {
      return [];
    }
    const parts: SharedChatPartContent[] = [];
    for (const part of message.parts) {
      if (part.type === "text") {
        const text = toShareText(part.text, postTitles);
        if (text) {
          parts.push({ type: "text", text });
        }
        continue;
      }
      if (part.type === "file") {
        parts.push({
          type: "file",
          filename: part.filename ?? "attachment",
          mediaType: part.mediaType,
        });
        continue;
      }
      if (!isToolUIPart(part)) {
        continue;
      }
      const name = getToolName(part);
      if (name === UPDATE_TODOS_TOOL_NAME) {
        continue;
      }
      if (part.type !== "dynamic-tool" && getCreateToolContentType(part.type)) {
        const post = postsByToolCallId.get(part.toolCallId);
        if (post) {
          parts.push({
            type: "post",
            contentType: post.contentType,
            title: post.title,
            markdown: post.markdown,
          });
        }
        continue;
      }
      const last = parts.at(-1);
      if (last?.type === "tools") {
        if (!last.names.includes(name)) {
          last.names.push(name);
        }
      } else {
        parts.push({ type: "tools", names: [name] });
      }
    }
    return parts.length > 0
      ? [
          {
            // Positional ids, so internal message ids stay private.
            id: `m${position}`,
            role: message.role,
            parts: parts.map((part, index) => ({
              ...part,
              id: `m${position}:${index}`,
            })),
          },
        ]
      : [];
  });
}
