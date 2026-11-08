export const AUTOPILOT_ADMIN_PATH = "/api/internal/autopilot/admin";
export const AUTOPILOT_ADMIN_PAGE_SIZE = 50;
export const AUTOPILOT_ADMIN_POLL_MS = 15_000;
export const AUTOPILOT_ADMIN_REQUEST_TIMEOUT_MS = 20_000;
export const AUTOPILOT_HEARTBEAT_WARNING_MS = 5 * 60 * 1000;
/** Waterfall axis spacing; the first that keeps it to eight ticks wins. */
export const AUTOPILOT_TIMELINE_TICK_STEPS_MS = [
  1000, 2000, 5000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000,
  1_800_000, 3_600_000,
];
export const AUTOPILOT_TIMELINE_MAX_TICKS = 8;
/** Steps logged before step telemetry existed only have a message. */
export const AUTOPILOT_LEGACY_STEP_MESSAGE = /^(?:Agent|Writer) step (\d+)$/;
export const AUTOPILOT_AGENT_PROMPT_MESSAGE = /prompt$/i;
export const AUTOPILOT_OPENED_PULL_REQUEST = /^Opened pull request #/;
/** A failed structured call: "Retrying <model> (<tag>)". */
export const AUTOPILOT_RETRY_MESSAGE = /^Retrying (\S+) \(/;
export const AUTOPILOT_RUN_LANE = "run";

/** Data fields a span's tooltip already shows in its own rows. */
export const AUTOPILOT_SPAN_DATA_FIELDS = new Set([
  "kind",
  "step",
  "steps",
  "model",
  "durationMs",
  "inputTokens",
  "outputTokens",
  "cachedInputTokens",
  "reasoningTokens",
  "tools",
  "finishReason",
]);

/** Tooltip rows per event, and characters per value, before cutting off. */
export const AUTOPILOT_TOOLTIP_MAX_DETAILS = 6;
export const AUTOPILOT_TOOLTIP_MAX_VALUE_CHARS = 90;

/** A step's end event lands just before its loop's finish event. */
export const AUTOPILOT_STEP_PARENT_SLACK_MS = 2000;

/** AI SDK finish reasons, as a sentence for the tooltip. */
export const AUTOPILOT_FINISH_REASON_LABEL: Record<string, string> = {
  stop: "Answered",
  "tool-calls": "Called tools",
  length: "Hit the output token limit",
  "content-filter": "Blocked by the content filter",
  error: "Errored",
};
