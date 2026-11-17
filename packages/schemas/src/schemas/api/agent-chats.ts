import "zod/compile";
import { z } from "@hono/zod-openapi";

const AGENT_MESSAGE_MAX_LENGTH = 200_000;
const AGENT_SESSION_LIST_LIMIT_MAX = 50;

export const createAgentSessionRequestSchema = z
  .object({
    message: z
      .string()
      .min(1)
      .max(AGENT_MESSAGE_MAX_LENGTH)
      .openapi({ description: "The first user message of the session." }),
  })
  .openapi("CreateAgentSessionRequest");

export const createAgentSessionResponseSchema = z
  .object({
    ok: z.literal(true),
    sessionId: z.string(),
  })
  .openapi("CreateAgentSessionResponse");

const agentInputResponseSchema = z.object({
  requestId: z.string().min(1).openapi({
    description:
      "The interactionId of the pending interaction.opened event to answer.",
  }),
  optionId: z.string().min(1).openapi({
    description:
      'The chosen option id from the interaction.opened event, e.g. "approve" or "deny".',
  }),
});

export const sendAgentMessageRequestSchema = z
  .object({
    message: z
      .string()
      .min(1)
      .max(AGENT_MESSAGE_MAX_LENGTH)
      .optional()
      .openapi({
        description:
          "The next user message. Omit when only answering a pending input request.",
      }),
    inputResponses: z.array(agentInputResponseSchema).optional().openapi({
      description:
        "Answers to pending interaction.opened events (tool approvals, questions) from the event stream.",
    }),
  })
  .openapi("SendAgentMessageRequest");

export const agentSessionParamsSchema = z.object({
  sessionId: z
    .string()
    .min(1)
    .openapi({ param: { name: "sessionId" } }),
});

export const agentSessionStreamQuerySchema = z.object({
  startIndex: z.coerce.number().int().min(0).optional().openapi({
    description:
      "Index of the first stored line to send, to resume a stream after the last line you received.",
  }),
});

export const listAgentChatsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(AGENT_SESSION_LIST_LIMIT_MAX)
    .default(20),
});

const agentSessionSummarySchema = z
  .object({
    sessionId: z.string(),
    chatId: z.string().nullable(),
    surface: z.string(),
    status: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("AgentSessionSummary");

export const listAgentChatsResponseSchema = z
  .object({
    sessions: z.array(agentSessionSummarySchema),
  })
  .openapi("ListAgentChatsResponse");
