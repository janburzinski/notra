/** How many of a tool's input fields the approval card shows as chips. */
export const CHAT_APPROVAL_CHIP_LIMIT = 4;

/** An answer row in the approval card: no outline, tinted once picked. */
export const CHAT_APPROVAL_ROW_CLASS =
  "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-fast ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
export const CHAT_APPROVAL_ROW_IDLE_CLASS = "hover:bg-muted";
export const CHAT_APPROVAL_ROW_PICKED_CLASS = "bg-primary/8";

/**
 * Tools that ask for every call: each one spends AI answers on its own input
 * (a prompt, its engines), so allowing one call must not allow the next.
 */
export const CHAT_APPROVAL_ONCE_ONLY_TOOL_NAMES: ReadonlySet<string> = new Set([
  "scanGeoPrompt",
]);
