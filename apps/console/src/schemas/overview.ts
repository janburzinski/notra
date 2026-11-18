import * as z from "zod";

import { OVERVIEW_DEFAULT_DAYS, OVERVIEW_MAX_DAYS } from "@/constants/overview";

export const overviewInsightsInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(OVERVIEW_MAX_DAYS)
    .default(OVERVIEW_DEFAULT_DAYS),
});
