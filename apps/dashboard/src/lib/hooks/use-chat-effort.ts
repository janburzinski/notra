"use client";

import { useStoredChatPreferences } from "@/lib/hooks/use-stored-chat-preferences";
import type { ChatEffortMenuProps } from "@/types/components/chat-input";

/** Effort picker state shared by every agent sidebar composer. */
export function useChatEffort(): Omit<ChatEffortMenuProps, "disabled"> {
  const { preferences, update } = useStoredChatPreferences();

  return {
    onThinkingLevelChange: (thinkingLevel) => update({ thinkingLevel }),
    thinkingLevel: preferences.thinkingLevel,
  };
}
