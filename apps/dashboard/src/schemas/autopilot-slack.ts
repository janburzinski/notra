import * as z from "zod";

export const slackApiResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

/** A delivery only counts when Slack confirms it with a channel and a ts. */
export const slackPostMessageResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    channel: z.string().min(1),
    ts: z.string().min(1),
  }),
  z.object({ ok: z.literal(false), error: z.string().optional() }),
]);

export const slackUserInfoResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  user: z
    .object({
      team_id: z.string().optional(),
      deleted: z.boolean().optional(),
      is_bot: z.boolean().optional(),
      is_restricted: z.boolean().optional(),
      is_ultra_restricted: z.boolean().optional(),
      profile: z.object({ email: z.string().optional() }).optional(),
    })
    .optional(),
});
