import * as z from "zod";

import { AUTOPILOT_DREAM_LESSON_AREAS } from "@/constants/autopilot-dream";

export const dreamConsolidationSchema = z.object({
  lessons: z.array(
    z.object({
      pullRequest: z.string(),
      key: z.string(),
      area: z.enum(AUTOPILOT_DREAM_LESSON_AREAS),
      lesson: z.string(),
      explicit: z.boolean(),
      reverses: z.boolean(),
    })
  ),
  merges: z.array(z.object({ keep: z.string(), drop: z.array(z.string()) })),
});
