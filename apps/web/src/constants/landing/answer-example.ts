import type { DateTimeFormatOptions } from "use-intl";

import type {
  AnswerEngineResult,
  AnswerExampleEngineId,
  AnswerExampleFactId,
  AnswerPositionTone,
  AnswerSentiment,
} from "@/types/landing/geo";

export const ANSWER_EXAMPLE_DEFAULT_ENGINE: AnswerExampleEngineId = "chatgpt";

export const ANSWER_EXAMPLE_TIMESTAMP = Date.UTC(2026, 7, 26, 9, 41);

export const ANSWER_EXAMPLE_TIMESTAMP_FORMAT: DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export const ANSWER_EXAMPLE_RESULTS: AnswerEngineResult[] = [
  {
    id: "chatgpt",
    mentioned: true,
    position: 2,
    sentiment: "positive",
  },
  {
    id: "perplexity",
    mentioned: true,
    position: 1,
    sentiment: "positive",
  },
  {
    id: "claude",
    mentioned: true,
    position: 3,
    sentiment: "neutral",
  },
  {
    id: "gemini",
    mentioned: false,
    position: null,
    sentiment: "neutral",
  },
];

export const ANSWER_EXAMPLE_SENTIMENT_CLASS: Record<AnswerSentiment, string> = {
  positive: "text-geo-up",
  neutral: "text-muted-foreground",
  negative: "text-geo-down",
};

export const ANSWER_EXAMPLE_POSITION_TOP = 2;
export const ANSWER_EXAMPLE_POSITION_MID = 4;

export const ANSWER_EXAMPLE_POSITION_CLASS: Record<AnswerPositionTone, string> =
  {
    top: "border-geo-up/40 bg-geo-up/10 text-[color-mix(in_oklab,var(--color-geo-up)_80%,black)] dark:text-geo-up",
    mid: "border-geo-mid/40 bg-geo-mid/10 text-[color-mix(in_oklab,var(--color-geo-mid)_80%,black)] dark:text-geo-mid",
    low: "border-border bg-muted text-muted-foreground",
  };

export const ANSWER_EXAMPLE_FACTS: readonly AnswerExampleFactId[] = [
  "full",
  "live",
  "reply",
];
