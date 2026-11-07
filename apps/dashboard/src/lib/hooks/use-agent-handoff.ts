"use client";

import { useEffect, useEffectEvent } from "react";

import { useRightPanel } from "@/components/dashboard/right-panel-context";
import type { AgentPanelPrompt } from "@/types/components/right-panel";

/** Puts text drafted elsewhere, such as "Build a workflow", in this composer while it shows. */
export function useAgentDraftTarget(
  active: boolean,
  apply: (text: string) => void
) {
  const { registerAgentDraftTarget } = useRightPanel();
  const onDraft = useEffectEvent(apply);
  useEffect(() => {
    if (!active) {
      return;
    }
    return registerAgentDraftTarget((text) => onDraft(text));
  }, [active, registerAgentDraftTarget]);
}

/** Sends a prompt asked from elsewhere, such as the prompt bar, once the agent's chat is ready. */
export function useAgentPromptTarget(
  ready: boolean,
  send: (prompt: AgentPanelPrompt) => void
) {
  const { agentPrompt, takeAgentPrompt } = useRightPanel();
  const onPrompt = useEffectEvent(send);
  useEffect(() => {
    if (!(agentPrompt && ready)) {
      return;
    }
    // Wait for the chat to finish mounting: a message sent from the very
    // first effect is dropped when React remounts the chat in development.
    const timer = window.setTimeout(() => {
      takeAgentPrompt(agentPrompt.id);
      onPrompt(agentPrompt);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [agentPrompt, ready, takeAgentPrompt]);
}
