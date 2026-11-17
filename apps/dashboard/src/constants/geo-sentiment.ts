export const SENTIMENT_POLARITY_STYLES = {
  positive: { fill: "bg-geo-up", text: "text-geo-up" },
  neutral: { fill: "bg-muted-foreground/30", text: "text-muted-foreground" },
  negative: { fill: "bg-geo-down", text: "text-geo-down" },
};
export const GEO_SENTIMENT_EMPTY_LABEL_KEYS = {
  noSavedAnswers: "noSavedAnswersRunA",
  noRatedMentions: "noRatedMentionsInThis",
} as const;

export const SENTIMENT_POLARITIES = [
  "positive",
  "neutral",
  "negative",
] as const;
export const SENTIMENT_PREVIEW_ROWS = [46, 38, 52, 34, 42] as const;
export const SENTIMENT_TREND_SCORE_KEY = "score";
export const SENTIMENT_TREND_LINE_KEY = "trend";
