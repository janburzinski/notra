import type { RefObject } from "react";

import type { AutopilotAgentDockMode } from "@/types/autopilot-workflows";

export interface UseOpenAgentChatPageOptions {
  organizationSlug: string;
  chatId: string;
  onClose: () => void;
  /** Whether the chat has anything to open, read when the link is used. */
  hasConversation: () => boolean;
}

export interface UseAutopilotDockKeysOptions {
  dockRef: RefObject<HTMLElement | null>;
  mode: AutopilotAgentDockMode;
  setMode: (mode: AutopilotAgentDockMode) => void;
  hasMessages: boolean;
}
