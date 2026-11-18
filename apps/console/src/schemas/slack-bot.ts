import * as z from "zod";

import {
  SLACK_BOT_DEFAULT_DAYS,
  SLACK_BOT_MAX_DAYS,
} from "@/constants/slack-bot";

export const slackBotInsightsInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(SLACK_BOT_MAX_DAYS)
    .default(SLACK_BOT_DEFAULT_DAYS),
});
