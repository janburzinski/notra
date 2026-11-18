import { z } from "@hono/zod-openapi";

export const webhookEventTypeSchema = z.enum([
  "post.generation.completed",
  "post.generation.failed",
  "post.generation.skipped",
  "brand_identity.generation.completed",
  "brand_identity.generation.failed",
  "post.published",
  "post.created",
  "post.updated",
  "post.deleted",
  "post.unpublished",
  "geo.scan.completed",
  "geo.scan.failed",
  "geo.alert.triggered",
]);
export const webhookStatusFilterSchema = z.enum([
  "all",
  "pending",
  "sending",
  "retrying",
  "succeeded",
  "failed",
  "cancelled",
]);
export const webhookEventsInputSchema = z
  .array(webhookEventTypeSchema)
  .min(1)
  .max(webhookEventTypeSchema.options.length);
export const webhookUrlInputSchema = z.string().url().max(2048);
export const createWebhookRequestSchema = z.object({
  url: webhookUrlInputSchema,
  events: webhookEventsInputSchema,
});
export const webhookEndpointParamsSchema = z.object({
  endpointId: z.string().min(1),
});
export const webhookDeliveryParamsSchema = z.object({
  deliveryId: z.string().min(1),
});
export const webhookDeliveryQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).max(100000).default(0).openapi({
    description:
      "Deliveries to skip. Pages hold 25 deliveries, newest first, so pass a multiple of 25. Defaults to 0.",
  }),
  status: webhookStatusFilterSchema.default("all").openapi({
    description: "Only return deliveries with this status. Defaults to all.",
  }),
});
const webhookEndpointSchema = z.object({
  id: z.string().openapi({
    description: "The endpoint's ID, used as endpointId in endpoint routes.",
  }),
  organizationId: z.string().openapi({
    description: "ID of the organization that owns the endpoint.",
  }),
  url: z.string().openapi({
    description: "HTTPS URL that receives signed POST requests.",
  }),
  events: z.array(webhookEventTypeSchema).openapi({
    description: "Event types delivered to this endpoint.",
  }),
  enabled: z.boolean().openapi({
    description: "Disabled endpoints receive no deliveries.",
  }),
  createdAt: z.string().openapi({
    description: "When the endpoint was created, as an ISO 8601 timestamp.",
  }),
});
export const webhookIdentifierSchema = z
  .object({
    id: z.string().openapi({
      description:
        "ID of the endpoint that was deleted or the delivery that was queued for retry.",
    }),
  })
  .openapi({ description: "Confirms which resource the request acted on." });
const webhookDeliverySchema = z.object({
  id: z.string().openapi({
    description: "Sent to the endpoint in the x-notra-delivery-id header.",
  }),
  eventId: z.string().openapi({
    description:
      "The event this delivery carries, sent in the x-notra-event-id header. Each subscribed endpoint gets its own delivery of the same event.",
  }),
  endpointId: z.string().openapi({
    description: "ID of the endpoint the delivery is sent to.",
  }),
  url: z.string().openapi({
    description: "URL the delivery is sent to.",
  }),
  eventType: webhookEventTypeSchema.openapi({
    description: "Type of event the delivery carries.",
  }),
  status: z
    .enum([
      "pending",
      "sending",
      "retrying",
      "succeeded",
      "failed",
      "cancelled",
    ])
    .openapi({
      description:
        "pending waits for its first attempt, sending is in flight and retrying waits for another attempt. succeeded got a 2xx response; failed ran out of attempts or hit an error that is not retried; cancelled stopped because the endpoint was removed or disabled.",
    }),
  attemptCount: z.number().openapi({
    description:
      "Attempts made so far. Up to 8 attempts are made, and a manual retry allows 8 more.",
  }),
  nextAttemptAt: z.string().openapi({
    description:
      "When the next attempt is due. Only meaningful while pending or retrying.",
  }),
  createdAt: z.string().openapi({
    description: "When the delivery was created, as an ISO 8601 timestamp.",
  }),
  statusCode: z.number().nullable().openapi({
    description:
      "HTTP status of the latest attempt. Null before the first attempt finishes or when no response came back.",
  }),
  error: z.string().nullable().openapi({
    description:
      "Error code of the latest attempt: http_<status> for a non-2xx response, or network, timeout (no response within 10 seconds), unsafe_url, signing_failed or lease_expired_outcome_unknown. Null when it succeeded or has not finished.",
  }),
});
const webhookAttemptSchema = z.object({
  id: z.string().openapi({ description: "The attempt's ID." }),
  deliveryId: z.string().openapi({
    description: "ID of the delivery the attempt belongs to.",
  }),
  attemptNumber: z.number().openapi({
    description: "Position of the attempt, starting at 1.",
  }),
  startedAt: z.string().openapi({
    description: "When the attempt started, as an ISO 8601 timestamp.",
  }),
  finishedAt: z.string().nullable().openapi({
    description: "Null while the attempt is in flight.",
  }),
  statusCode: z.number().nullable().openapi({
    description:
      "HTTP status the endpoint returned, or null without a response.",
  }),
  error: z.string().nullable().openapi({
    description:
      "Error code: http_<status> for a non-2xx response, or network, timeout, unsafe_url, signing_failed or lease_expired_outcome_unknown. Null on success or while in flight.",
  }),
  durationMs: z.number().nullable().openapi({
    description: "Request duration in milliseconds.",
  }),
});
export const webhookListResponseSchema = z
  .object({
    endpoints: z.array(webhookEndpointSchema).openapi({
      description: "Every webhook endpoint in the workspace.",
    }),
  })
  .openapi({ description: "The workspace's webhook endpoints." });
export const webhookCreateResponseSchema = z
  .object({
    endpoint: webhookEndpointSchema.openapi({
      description: "The endpoint that was created.",
    }),
    secret: z.string().openapi({
      description:
        "Signing secret, starting with whsec_. Returned only here; use it to verify the x-notra-signature header on each request.",
    }),
  })
  .openapi({
    description: "The new webhook endpoint and its signing secret.",
  });
export const webhookDeliveriesResponseSchema = z
  .object({
    deliveries: z.array(webhookDeliverySchema).openapi({
      description: "Up to 25 deliveries, newest first.",
    }),
    hasMore: z.boolean().openapi({
      description:
        "More deliveries follow. Request the next page with offset + 25.",
    }),
  })
  .openapi({ description: "A page of webhook deliveries." });
export const webhookDetailResponseSchema = z
  .object({
    delivery: webhookDeliverySchema
      .extend({
        payload: z.string().openapi({
          description:
            "The JSON request body sent to the endpoint, as a string.",
        }),
      })
      .openapi({ description: "The delivery with its request body." }),
    attempts: z.array(webhookAttemptSchema).openapi({
      description: "Every attempt, oldest first.",
    }),
  })
  .openapi({ description: "A webhook delivery and its attempts." });
