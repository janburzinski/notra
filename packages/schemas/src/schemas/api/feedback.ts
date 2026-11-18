import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  AGENT_FEEDBACK_IDEMPOTENCY_KEY_MAX_LENGTH,
  AGENT_FEEDBACK_KINDS,
  AGENT_FEEDBACK_MESSAGE_MAX_LENGTH,
  AGENT_FEEDBACK_METADATA_MAX_BYTES,
  AGENT_FEEDBACK_SENTIMENTS,
  AGENT_FEEDBACK_SHORT_FIELD_MAX_LENGTH,
  AGENT_FEEDBACK_SOURCES,
  AGENT_FEEDBACK_STATUSES,
  AGENT_FEEDBACK_TITLE_MAX_LENGTH,
  AGENT_FEEDBACK_URL_MAX_LENGTH,
} from "@notra/db/constants/agent-feedback";

import {
  FEEDBACK_LIST_DEFAULT_LIMIT,
  FEEDBACK_LIST_MAX_LIMIT,
} from "../../constants/feedback";
import { resourceIdSchema } from "./ids";

const ORGANIZATION_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

const feedbackKindSchema = z.enum(AGENT_FEEDBACK_KINDS).openapi({
  description: "What kind of feedback this is.",
  example: "bug",
});

const feedbackSentimentSchema = z.enum(AGENT_FEEDBACK_SENTIMENTS).openapi({
  description: "Overall sentiment of the feedback.",
  example: "negative",
});

const feedbackStatusSchema = z.enum(AGENT_FEEDBACK_STATUSES).openapi({
  description: "Triage status.",
  example: "new",
});

const feedbackSourceSchema = z.enum(AGENT_FEEDBACK_SOURCES).openapi({
  description: "Channel the feedback arrived through.",
  example: "mcp",
});

const shortFieldSchema = z
  .string()
  .trim()
  .min(1)
  .max(AGENT_FEEDBACK_SHORT_FIELD_MAX_LENGTH);

const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (value) =>
      JSON.stringify(value).length <= AGENT_FEEDBACK_METADATA_MAX_BYTES,
    `metadata must be ${AGENT_FEEDBACK_METADATA_MAX_BYTES} bytes or fewer`
  )
  .openapi({
    description: "Arbitrary JSON attached to the feedback, up to 8 KB.",
  });

export const submitFeedbackRequestSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1, "message is required")
      .max(
        AGENT_FEEDBACK_MESSAGE_MAX_LENGTH,
        `message must be ${AGENT_FEEDBACK_MESSAGE_MAX_LENGTH} characters or fewer`
      )
      .openapi({
        description: "The feedback itself.",
        example: "The search tool times out when the query has quotes.",
      }),
    title: z
      .string()
      .trim()
      .min(1)
      .max(AGENT_FEEDBACK_TITLE_MAX_LENGTH)
      .optional()
      .openapi({
        description: "Short summary. When omitted, Notra writes one.",
        example: "Search times out on quoted queries",
      }),
    kind: feedbackKindSchema.optional().openapi({
      description:
        "What kind of feedback this is. When omitted, Notra classifies it.",
    }),
    sentiment: feedbackSentimentSchema.optional().openapi({
      description:
        "Overall sentiment. When omitted, Notra classifies it from the message.",
    }),
    source: feedbackSourceSchema.default("api"),
    projectId: resourceIdSchema("projectId").optional().openapi({
      description: "Project to file the feedback under.",
    }),
    agentClient: shortFieldSchema.optional().openapi({
      description: "The agent or client that submitted the feedback.",
      example: "claude-code",
    }),
    agentModel: shortFieldSchema.optional().openapi({
      example: "claude-opus-5",
    }),
    toolVersion: shortFieldSchema.optional().openapi({ example: "1.2.0" }),
    userAgent: z
      .string()
      .trim()
      .min(1)
      .max(AGENT_FEEDBACK_URL_MAX_LENGTH)
      .optional(),
    contextUrl: z
      .string()
      .trim()
      .url()
      .max(AGENT_FEEDBACK_URL_MAX_LENGTH)
      .optional()
      .openapi({
        description: "Page or resource the feedback is about.",
        example: "https://docs.example.com/api/search",
      }),
    externalId: shortFieldSchema.optional().openapi({
      description: "Your own identifier for the user or session.",
    }),
    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(AGENT_FEEDBACK_IDEMPOTENCY_KEY_MAX_LENGTH)
      .optional()
      .openapi({
        description:
          "Submitting the same key twice returns the original feedback instead of creating a duplicate.",
      }),
    metadata: metadataSchema.optional(),
  })
  .openapi("SubmitFeedbackRequest");

export const feedbackOrganizationParamsSchema = z.object({
  organizationSlug: z
    .string()
    .trim()
    .min(1, "organizationSlug is required")
    .max(63)
    .regex(ORGANIZATION_SLUG_REGEX, "organizationSlug has an invalid format")
    .openapi({
      param: { in: "path", name: "organizationSlug" },
      description:
        "Your organization slug, as shown in your feedback URL on the Feedback page.",
      example: "acme",
    }),
});

export const feedbackParamsSchema = z.object({
  feedbackId: resourceIdSchema("feedbackId").openapi({
    param: { in: "path", name: "feedbackId" },
    example: "fb_123",
  }),
});

export const listFeedbackQuerySchema = z.object({
  status: feedbackStatusSchema.optional(),
  kind: feedbackKindSchema.optional(),
  projectId: resourceIdSchema("projectId").optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FEEDBACK_LIST_MAX_LIMIT)
    .default(FEEDBACK_LIST_DEFAULT_LIMIT)
    .openapi({
      description: `Items per page. Defaults to ${FEEDBACK_LIST_DEFAULT_LIMIT}.`,
      example: 25,
    }),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .openapi({ description: "Page number. Defaults to 1.", example: 1 }),
});

export const updateFeedbackRequestSchema = z
  .object({
    status: feedbackStatusSchema,
  })
  .openapi("UpdateFeedbackRequest");

const feedbackSchema = z
  .object({
    id: z.string().openapi({
      description:
        "The feedback's ID, used as feedbackId in /v1/feedback/{feedbackId}.",
    }),
    projectId: z.string().nullable().openapi({
      description: "Project the feedback is filed under, or null for none.",
    }),
    source: feedbackSourceSchema,
    kind: feedbackKindSchema.openapi({
      description:
        "What kind of feedback this is, as submitted or classified by Notra. other when classification failed.",
    }),
    sentiment: feedbackSentimentSchema.nullable().openapi({
      description:
        "Overall sentiment, as submitted or classified by Notra. Null when it could not be classified.",
    }),
    status: feedbackStatusSchema,
    title: z.string().nullable().openapi({
      description:
        "Short summary, as submitted or written by Notra. Null when none could be written.",
    }),
    message: z.string().openapi({ description: "The feedback itself." }),
    agentClient: z.string().nullable().openapi({
      description:
        "The agent or client that submitted the feedback, or null when not given.",
    }),
    agentModel: z.string().nullable().openapi({
      description: "Model the agent ran on, or null when not given.",
    }),
    toolVersion: z.string().nullable().openapi({
      description:
        "Version of the tool or client that submitted it, or null when not given.",
    }),
    userAgent: z.string().nullable().openapi({
      description:
        "User agent as submitted, falling back to the request's User-Agent header, or null when neither was present.",
    }),
    contextUrl: z.string().nullable().openapi({
      description:
        "Page or resource the feedback is about, or null when not given.",
    }),
    externalId: z.string().nullable().openapi({
      description:
        "The submitter's own identifier for the user or session, or null when not given.",
    }),
    idempotencyKey: z.string().nullable().openapi({
      description:
        "Idempotency key sent with the submission, or null when none was sent.",
    }),
    metadata: z.record(z.string(), z.unknown()).nullable().openapi({
      description: "JSON submitted with the feedback, or null.",
    }),
    resolvedAt: z.string().nullable().openapi({
      description:
        "When the status was last set to resolved. Cleared when it changes to another status.",
    }),
    createdAt: z.string().openapi({
      description: "When the feedback was submitted, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description: "When the feedback last changed, as an ISO 8601 timestamp.",
    }),
  })
  .openapi("Feedback", {
    description: "A piece of feedback submitted by an agent, app or person.",
  });

export const submitFeedbackResponseSchema = z
  .object({
    feedback: feedbackSchema,
    deduplicated: z.boolean().openapi({
      description:
        "True when an existing feedback was returned instead of a new one: same idempotencyKey, or without one, an identical submission within 10 minutes.",
    }),
  })
  .openapi("SubmitFeedbackResponse", {
    description:
      "The stored feedback and whether it matched an earlier submission.",
  });

const feedbackPaginationSchema = z
  .object({
    limit: z.number().int().min(1).openapi({
      description: "Items per page.",
    }),
    currentPage: z.number().int().min(1).openapi({
      description: "The page returned, starting at 1.",
    }),
    nextPage: z.number().int().min(1).nullable().openapi({
      description: "Next page number, or null on the last page.",
    }),
    previousPage: z.number().int().min(1).nullable().openapi({
      description: "Previous page number, or null on the first page.",
    }),
    totalPages: z.number().int().min(1).openapi({
      description:
        "Total pages for the filters, at least 1 even with no results.",
    }),
    totalItems: z.number().int().min(0).openapi({
      description: "Total feedback items matching the filters.",
    }),
  })
  .openapi({ description: "Page position and totals for the list." });

export const listFeedbackResponseSchema = z
  .object({
    feedback: z.array(feedbackSchema).openapi({
      description: "Feedback on this page, newest first.",
    }),
    pagination: feedbackPaginationSchema,
  })
  .openapi("ListFeedbackResponse", {
    description: "A page of the workspace's feedback.",
  });

export const feedbackResponseSchema = z
  .object({
    feedback: feedbackSchema,
  })
  .openapi("FeedbackResponse", { description: "The feedback item." });
