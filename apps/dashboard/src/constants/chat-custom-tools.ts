import { AUTOPILOT_WORKFLOW_PREVIEW_TOOLS } from "@/constants/autopilot-workflows";
import { CHAT_CREATE_TOOL_NAMES } from "@/constants/chat-posts";

/** Tools the chat page shows on their own card, approval buttons included. */
export const CHAT_PAGE_CARD_TOOL_NAMES: ReadonlySet<string> = new Set([
  ...CHAT_CREATE_TOOL_NAMES,
  ...AUTOPILOT_WORKFLOW_PREVIEW_TOOLS,
]);
