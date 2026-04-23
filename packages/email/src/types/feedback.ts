export type FeedbackSentiment = "sad_crying" | "sad" | "happy" | "excited";

export interface FeedbackSentimentMeta {
  emoji: string;
  label: string;
}

export interface FeedbackEmailProps {
  message: string;
  sentiment?: FeedbackSentiment;
  userName: string;
  userEmail: string;
  organizationName?: string;
  organizationSlug?: string;
  pageUrl?: string;
  userAgent?: string;
}
