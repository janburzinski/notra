import "zod/compile";
import { z } from "zod";

export const slackPostMessageResponseSchema = z.looseObject({
  ok: z.boolean(),
  ts: z.string().optional(),
  error: z.string().optional(),
});

export const slackExternalChannelKeySchema = z
  .string()
  .regex(/^[^:]+:[^:]+:[^:]+$/u);

export const slackPermalinkResponseSchema = z.looseObject({
  ok: z.boolean(),
  permalink: z.string().optional(),
});

export const relaySlackApprovalSchema = z.object({
  requestId: z.string().min(1).max(200),
  approved: z.boolean(),
});

export const slackRepliesResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
  messages: z
    .array(
      z.looseObject({
        ts: z.string(),
        bot_id: z.string().optional(),
        blocks: z
          .array(
            z.looseObject({
              elements: z
                .array(
                  z.looseObject({
                    action_id: z.string().optional(),
                    value: z.string().optional(),
                  })
                )
                .optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

/** A Slack thread as the dashboard reads it to fill a chat mirrored empty. */
export const slackThreadRepliesResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
  messages: z
    .array(
      z.looseObject({
        ts: z.string(),
        user: z.string().optional(),
        bot_id: z.string().optional(),
        subtype: z.string().optional(),
        text: z.string().optional(),
        metadata: z
          .looseObject({
            event_type: z.string().optional(),
            event_payload: z
              .looseObject({
                user_name: z.string().optional(),
                text: z.string().optional(),
              })
              .optional(),
          })
          .optional(),
      })
    )
    .optional(),
  response_metadata: z
    .looseObject({ next_cursor: z.string().optional() })
    .optional(),
});

export const slackAuthTestResponseSchema = z.looseObject({
  ok: z.boolean(),
  user_id: z.string().optional(),
  bot_id: z.string().optional(),
});

export const slackConversationInfoResponseSchema = z.looseObject({
  ok: z.boolean(),
  channel: z
    .looseObject({
      is_private: z.boolean().optional(),
      is_im: z.boolean().optional(),
      is_mpim: z.boolean().optional(),
    })
    .optional(),
});

export const slackUserProfileResponseSchema = z.looseObject({
  ok: z.boolean(),
  user: z
    .looseObject({
      name: z.string().optional(),
      real_name: z.string().optional(),
      profile: z
        .looseObject({
          display_name: z.string().optional(),
          real_name: z.string().optional(),
          image_72: z.url().optional(),
        })
        .optional(),
    })
    .optional(),
});
