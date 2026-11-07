"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";

import { trackEvent } from "@/lib/analytics/posthog-client";
import { useStoredChatPreferences } from "@/lib/hooks/use-stored-chat-preferences";
import type { ChatEffortMenuProps } from "@/types/components/chat-input";

/** Effort picker state shared by every agent sidebar composer. */
export function useChatEffort(): Omit<ChatEffortMenuProps, "disabled"> {
  const { preferences, update } = useStoredChatPreferences();

  return {
    onThinkingLevelChange: (thinkingLevel) => {
      update({ thinkingLevel });
      trackEvent(POSTHOG_EVENTS.CHAT_THINKING_LEVEL_CHANGED, {
        level: thinkingLevel,
      });
    },
    thinkingLevel: preferences.thinkingLevel,
  };
}
