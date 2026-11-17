"use client";

import { getToolName, type UIMessage } from "ai";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { CHAT_APPROVAL_ONCE_ONLY_TOOL_NAMES } from "@/constants/chat-approval";
import type { ChatComposerApproval } from "@/types/chat-approval";
import type { ChatToolPart } from "@/types/components/chat-conversation";
import {
  findComposerApproval,
  isComposerApprovalPart,
} from "@/utils/chat-tool-approval";

const NO_TOOLS: ReadonlySet<string> = new Set();

/**
 * The approval the composer asks about, and the tools allowed for the rest
 * of this chat. Those are approved as soon as they ask. The memory lives in
 * this tab only: after a reload, every tool asks again. Also says which
 * approvals the composer owns, so the reply hides their buttons.
 */
export function useChatToolApprovals({
  chatId,
  messages,
  ownCardToolNames,
  onApprove,
  onDeny,
}: {
  chatId: string | null;
  messages: UIMessage[];
  /** Tools whose approval stays on their own card in the reply. */
  ownCardToolNames?: ReadonlySet<string>;
  onApprove: (approvalId: string, part: ChatToolPart) => unknown;
  onDeny: (approvalId: string, part: ChatToolPart) => unknown;
}): {
  approval: ChatComposerApproval | null;
  isApprovalInComposer: (part: ChatToolPart) => boolean;
} {
  const t = useTranslations("chat.approval");
  const [allowed, setAllowed] = useState<{
    chatId: string | null;
    toolNames: ReadonlySet<string>;
  }>({ chatId, toolNames: NO_TOOLS });
  const allowedToolNames =
    allowed.chatId === chatId ? allowed.toolNames : NO_TOOLS;
  const answeredRef = useRef(new Set<string>());
  const [failedApprovalId, setFailedApprovalId] = useState<string | null>(null);
  const part = findComposerApproval(messages, ownCardToolNames);
  const approvalId =
    part?.state === "approval-requested" ? part.approval?.id : undefined;
  const toolName = part ? getToolName(part) : null;

  const answer = (allow: boolean) => {
    if (!(part && approvalId) || answeredRef.current.has(approvalId)) {
      return;
    }
    answeredRef.current.add(approvalId);
    const failed = () => {
      answeredRef.current.delete(approvalId);
      setFailedApprovalId(approvalId);
      toast.error(t("failed"));
    };
    try {
      Promise.resolve(
        allow ? onApprove(approvalId, part) : onDeny(approvalId, part)
      ).catch(failed);
    } catch {
      failed();
    }
  };

  const approveAllowedTool = useEffectEvent(() => answer(true));
  useEffect(() => {
    if (
      toolName &&
      approvalId &&
      approvalId !== failedApprovalId &&
      allowedToolNames.has(toolName)
    ) {
      approveAllowedTool();
    }
  }, [allowedToolNames, approvalId, failedApprovalId, toolName]);

  const isApprovalInComposer = (candidate: ChatToolPart) =>
    isComposerApprovalPart(candidate, ownCardToolNames);
  if (
    !(part && approvalId && toolName) ||
    (allowedToolNames.has(toolName) && approvalId !== failedApprovalId)
  ) {
    return { approval: null, isApprovalInComposer };
  }
  const approval: ChatComposerApproval = {
    part,
    onAllowOnce: () => answer(true),
    onAllowForChat: CHAT_APPROVAL_ONCE_ONLY_TOOL_NAMES.has(toolName)
      ? null
      : () => {
          setAllowed({
            chatId,
            toolNames: new Set([...allowedToolNames, toolName]),
          });
          answer(true);
        },
    onDeny: () => answer(false),
  };
  return { approval, isApprovalInComposer };
}
