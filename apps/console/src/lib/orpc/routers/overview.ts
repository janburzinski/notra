import { assertAdmin } from "@/lib/auth/admin";
import { baseProcedure } from "@/lib/orpc/base";
import { getOverviewInsights } from "@/lib/overview/queries";
import { overviewInsightsInputSchema } from "@/schemas/overview";

export const overviewRouter = {
  insights: baseProcedure
    .input(overviewInsightsInputSchema)
    .handler(async ({ context, input }) => {
      await assertAdmin({ headers: context.headers });
      return getOverviewInsights(input.days);
    }),
};
