import { z } from "zod";

/** The parts of Slack's `users.info` response the chat mirror reads. */
export const slackUserInfoSchema = z.object({
  ok: z.boolean(),
  user: z
    .object({
      name: z.string().optional(),
      real_name: z.string().optional(),
      profile: z
        .object({
          display_name: z.string().optional(),
          real_name: z.string().optional(),
          image_72: z.url().optional(),
        })
        .optional(),
    })
    .optional(),
});
