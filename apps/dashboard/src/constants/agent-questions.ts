/** The agent asks the user something with this tool; the answer comes from the chat UI. */
export const AGENT_QUESTION_TOOL_NAME = "askUserQuestion";

/** What the agent reads when the user dismisses its questions. */
export const AGENT_QUESTION_DISMISSED = "The user dismissed these questions";

/** Marks the question dock, so surrounding shortcuts leave its keys alone. */
export const AGENT_QUESTION_DOCK_ATTRIBUTE = "data-agent-question-dock";

/** One answer row in the question dock. */
export const AGENT_QUESTION_ROW_CLASS =
  "flex w-full min-w-0 items-start gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 ring-inset transition-[background-color,box-shadow] duration-fast ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
export const AGENT_QUESTION_ROW_IDLE_CLASS =
  "bg-muted/40 ring-border/70 hover:bg-muted";
export const AGENT_QUESTION_ROW_PICKED_CLASS = "bg-primary/8 ring-primary/30";

/** How long a picked answer shows before a pick-one question moves on. */
export const AGENT_QUESTION_ADVANCE_DELAY_MS = 180;

/** The chat input fades back in once the questions are answered. */
export const AGENT_QUESTION_INPUT_RETURN_CLASS =
  "duration-normal opacity-100 transition-opacity ease-out motion-reduce:transition-none starting:opacity-0";
