import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { CHAT_APPROVAL_CHIP_LIMIT } from "@/constants/chat-approval";
import type { ChatApprovalInputChip } from "@/types/chat-approval";
import type { ChatToolPart } from "@/types/components/chat-conversation";
import { isAgentQuestionPart } from "@/utils/agent-questions";
import { humanizeToolName } from "@/utils/chat-share";
import { parseCreatePostDraft } from "@/utils/chat-tool-draft";
import { truncateSnippet } from "@/utils/format";

const MAX_CHIP_VALUE_LENGTH = 60;

/**
 * A tool waiting for a plain yes or no, which the composer asks about. Post
 * drafts and the agent's questions keep their own cards in the reply, and so
 * do the tools a host draws itself.
 */
export function isComposerApprovalPart(
  part: UIMessage["parts"][number],
  ownCardToolNames?: ReadonlySet<string>
): part is ChatToolPart {
  if (!isToolUIPart(part) || part.state !== "approval-requested") {
    return false;
  }
  const toolName = getToolName(part);
  return !(
    ownCardToolNames?.has(toolName) ||
    isAgentQuestionPart(part) ||
    parseCreatePostDraft(part.input, toolName)
  );
}

/** The first tool of the last reply that waits on the composer's approval. */
export function findComposerApproval(
  messages: UIMessage[],
  ownCardToolNames?: ReadonlySet<string>
): ChatToolPart | null {
  const last = messages.at(-1);
  if (last?.role !== "assistant") {
    return null;
  }
  return (
    last.parts.find((part): part is ChatToolPart =>
      isComposerApprovalPart(part, ownCardToolNames)
    ) ?? null
  );
}

/** The input's simple fields as readable chips; nested values stay in the JSON. */
export function getApprovalInputChips(input: unknown): ChatApprovalInputChip[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }
  const chips: ChatApprovalInputChip[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (chips.length >= CHAT_APPROVAL_CHIP_LIMIT) {
      break;
    }
    if (
      (typeof value === "string" && value.trim()) ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      chips.push({
        key,
        label: humanizeToolName(key),
        value: truncateSnippet(String(value), MAX_CHIP_VALUE_LENGTH),
      });
    }
  }
  return chips;
}
