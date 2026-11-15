import type { UIMessage } from "ai";
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

export interface UseAutopilotDockActivityOptions {
  messages: UIMessage[];
  busy: boolean;
  expanded: boolean;
  /** The last request failed; its error shows instead of a reply. */
  failed: boolean;
}
