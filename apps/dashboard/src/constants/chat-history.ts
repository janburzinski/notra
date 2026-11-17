import type { ChatHistorySource } from "@/types/chat";

/** Order of the sources in the sidebar's filter menu. */
export const CHAT_HISTORY_SOURCES = [
  "dashboard",
  "slack",
] as const satisfies readonly ChatHistorySource[];

export const DEFAULT_CHAT_TITLE = "New chat";

/** How often the chat list refetches while a reply is streaming somewhere. */
export const CHAT_RUNNING_POLL_INTERVAL_MS = 4000;
/** How often it refetches otherwise, to notice runs started in another tab. */
export const CHAT_IDLE_POLL_INTERVAL_MS = 30_000;
