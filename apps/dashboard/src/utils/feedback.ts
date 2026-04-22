import {
  CryingIcon,
  LaughingIcon,
  Sad01Icon,
  SmileIcon,
} from "@hugeicons/core-free-icons";
import type { FeedbackSentimentOption } from "@/types/dashboard/feedback";

export const FEEDBACK_SENTIMENT_OPTIONS: FeedbackSentimentOption[] = [
  { value: "sad_crying", icon: CryingIcon, label: "Very unhappy" },
  { value: "sad", icon: Sad01Icon, label: "Unhappy" },
  { value: "happy", icon: SmileIcon, label: "Happy" },
  { value: "excited", icon: LaughingIcon, label: "Excited" },
];
