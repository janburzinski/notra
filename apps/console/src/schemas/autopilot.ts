import * as z from "zod";

import {
  AUTOPILOT_HEALTH_DEFAULT_DAYS,
  AUTOPILOT_HEALTH_MAX_DAYS,
} from "@/constants/autopilot";

export const autopilotHealthInputSchema = z.object({
  days: z
    .number()
    .int()
    .min(1)
    .max(AUTOPILOT_HEALTH_MAX_DAYS)
    .default(AUTOPILOT_HEALTH_DEFAULT_DAYS),
});
