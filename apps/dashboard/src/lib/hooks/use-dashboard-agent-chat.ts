"use client";

import { useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { authClient } from "@/lib/auth/client";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useAgentChat } from "@/lib/hooks/use-agent-chat";
import { useChatEffort } from "@/lib/hooks/use-chat-effort";
import type { ChatComposerHandle } from "@/types/components/chat-input";
import type { UseDashboardAgentChatOptions } from "@/types/components/dashboard-agent";
import type { AgentPanelPrompt } from "@/types/components/right-panel";

/**
 * The agent's conversation in the side panel and the Autopilot dock: the
 * chat page's agent, with a composer whose text the host holds, the shared
 * effort picker, and a new chat in place instead of on a new page.
 */
export function useDashboardAgentChat({
  organizationId,
  autopilotWorkflowId,
  autopilotAutomation,
}: UseDashboardAgentChatOptions) {
  const tChatErrors = useTranslations("chat.errors");
  const { projectId, isResolved } = useActiveProject();
  const { data: session } = authClient.useSession();
  const effort = useChatEffort();
  const [chatInputValue, setChatInputValue] = useState("");
  const chatInputRef = useRef<ChatComposerHandle | null>(null);
  const agent = useAgentChat({
    organizationId,
    projectId: isResolved ? projectId : null,
    thinkingLevel: effort.thinkingLevel,
    focus: { autopilotWorkflowId, autopilotAutomation },
    chatInputRef,
    authorUserId: session?.user.id,
    fallbackError: tChatErrors("agentFallback"),
  });

  const handleNewChat = () => {
    if (agent.isLoading) {
      return;
    }
    setChatInputValue("");
    if (agent.messagesRef.current.length === 0) {
      agent.setChatError(null);
      return;
    }
    agent.startNewChat();
  };

  /** Sends a prompt from elsewhere, such as a suggestion or another page. */
  const sendPrompt = (
    prompt: Pick<AgentPanelPrompt, "text" | "attachments">
  ) => {
    agent
      .handleSend(prompt.text, prompt.attachments ?? [])
      .catch((error: unknown) => {
        console.error("Failed to send agent prompt", error);
      });
  };

  return {
    ...agent,
    chatInputRef,
    chatInputValue,
    setChatInputValue,
    effort,
    handleNewChat,
    sendPrompt,
  };
}
