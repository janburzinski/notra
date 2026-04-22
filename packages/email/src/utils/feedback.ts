import type {
  FeedbackSentiment,
  FeedbackSentimentMeta,
} from "../types/feedback";

export const FEEDBACK_SENTIMENT_META: Record<
  FeedbackSentiment,
  FeedbackSentimentMeta
> = {
  sad_crying: { emoji: "😭", label: "Very unhappy" },
  sad: { emoji: "🙁", label: "Unhappy" },
  happy: { emoji: "🙂", label: "Happy" },
  excited: { emoji: "🤩", label: "Excited" },
};
