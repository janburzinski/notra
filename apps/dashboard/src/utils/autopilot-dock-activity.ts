import type { UIMessage } from "ai";

import type { AutopilotAgentDockActivity } from "@/types/autopilot-workflows";
import { hasPendingApproval } from "@/utils/chat-approvals";

function textOf(message: UIMessage | undefined) {
  if (!message) {
    return "";
  }
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The conversation's latest reply, and a signature that changes when it
 * grows: after an approval the agent keeps writing into the same message.
 */
export function latestReply(messages: UIMessage[]) {
  const reply = messages.findLast((message) => message.role === "assistant");
  return {
    id: reply?.id ?? null,
    signature: reply ? `${reply.id}:${reply.parts.length}` : null,
  };
}

/**
 * What the folded dock shows above its input: the agent working on your last
 * message, a tool waiting for your approval, or a reply you haven't opened.
 * Questions aren't here; they already take the input's place.
 */
export function autopilotDockActivity({
  messages,
  busy,
  unseenReplyId,
}: {
  messages: UIMessage[];
  busy: boolean;
  /** The reply that landed while the dock was folded, until it's opened. */
  unseenReplyId: string | null;
}): AutopilotAgentDockActivity | null {
  if (hasPendingApproval(messages)) {
    return { kind: "approval", text: "" };
  }
  if (busy) {
    const prompt = messages.findLast((message) => message.role === "user");
    return { kind: "working", text: textOf(prompt) };
  }
  if (unseenReplyId) {
    const reply = messages.find((message) => message.id === unseenReplyId);
    const text = textOf(reply);
    return text ? { kind: "replied", text } : null;
  }
  return null;
}
