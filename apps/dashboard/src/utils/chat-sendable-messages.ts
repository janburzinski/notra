import type { ChatUIMessage } from "@notra/ai/types/chat";
import { isToolUIPart } from "ai";

function hasSendableParts(message: ChatUIMessage): boolean {
  return Array.isArray(message.parts) && message.parts.length > 0;
}

/** A declined approval goes back to the agent as a denied call. */
function normalizeToolApprovalsForSend(
  messages: ChatUIMessage[]
): ChatUIMessage[] {
  return messages.map((message) => {
    if (!Array.isArray(message.parts)) {
      return message;
    }

    let changed = false;
    const parts = message.parts.map((part) => {
      if (
        isToolUIPart(part) &&
        part.state === "approval-responded" &&
        part.approval.approved === false &&
        (part.approval.reason === "discard" || part.approval.reason == null)
      ) {
        changed = true;
        return {
          ...part,
          approval: {
            ...part.approval,
            approved: false,
          },
          state: "output-denied" as const,
        } as ChatUIMessage["parts"][number];
      }

      return part;
    });

    return changed ? { ...message, parts } : message;
  }) as ChatUIMessage[];
}

/**
 * The messages a chat request carries. A reply stopped before its first
 * chunk leaves an empty message, which the request schema rejects.
 */
export function getSendableChatMessages(
  messages: ChatUIMessage[]
): ChatUIMessage[] {
  return normalizeToolApprovalsForSend(messages).filter(hasSendableParts);
}
