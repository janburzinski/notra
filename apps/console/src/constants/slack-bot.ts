import { SLACK_AGENT_REQUEST_RETENTION_DAYS } from "@notra/db/constants/slack-agent";
import type { ChartConfig } from "@notra/ui/components/ui/chart";

export const SLACK_BOT_RANGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

export const SLACK_BOT_DEFAULT_DAYS = 30;
export const SLACK_BOT_MAX_DAYS = SLACK_AGENT_REQUEST_RETENTION_DAYS - 1;
export const SLACK_BOT_REFETCH_MS = 60_000;
export const SLACK_BOT_TOP_TOOLS_LIMIT = 8;
export const SLACK_BOT_TOP_WORKSPACES_LIMIT = 10;

/** A request with no outcome after this long never got an answer. */
export const SLACK_BOT_UNANSWERED_AFTER_MS = 15 * 60 * 1000;

export const SLACK_BOT_ACTIVITY_CONFIG = {
  completed: {
    label: "Answered",
    theme: {
      light: "oklch(0.696 0.17 162.48)",
      dark: "oklch(0.765 0.177 163.22)",
    },
  },
  failed: {
    label: "Failed",
    theme: {
      light: "oklch(0.637 0.237 25.331)",
      dark: "oklch(0.704 0.191 22.216)",
    },
  },
  other: {
    label: "Stopped or unanswered",
    theme: {
      light: "oklch(0.872 0.01 258.338)",
      dark: "oklch(0.446 0.03 256.802)",
    },
  },
} satisfies ChartConfig;

export const SLACK_BOT_RESPONSE_CONFIG = {
  medianResponseSeconds: {
    label: "Median response (s)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;
