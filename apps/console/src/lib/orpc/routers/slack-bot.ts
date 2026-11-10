import { assertAdmin } from "@/lib/auth/admin";
import { baseProcedure } from "@/lib/orpc/base";
import { getSlackBotInsights } from "@/lib/slack-bot/queries";
import { slackBotInsightsInputSchema } from "@/schemas/slack-bot";

export const slackBotRouter = {
  insights: baseProcedure
    .input(slackBotInsightsInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return getSlackBotInsights(input.days);
    }),
};
