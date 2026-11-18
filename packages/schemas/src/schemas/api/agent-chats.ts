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
    ok: z.literal(true).openapi({
      description: "Always true when the session was created.",
    }),
    sessionId: z.string().openapi({
      description:
        "ID of the agent session, used to send follow-up messages and stream events.",
    }),
  })
  .openapi("CreateAgentSessionResponse")
  .openapi({ description: "The newly started agent session." });

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
    sessionId: z.string().openapi({
      description:
        "ID of the agent session, used with the /v2/eve/v1/session endpoints.",
    }),
    chatId: z.string().nullable().openapi({
      description:
        "Dashboard chat the session belongs to, or null for sessions not tied to a chat, such as those started through the API.",
    }),
    surface: z.string().openapi({
      description:
        "Where the session was started, such as standalone-chat for sessions started through the API or task for background content tasks.",
    }),
    status: z.string().openapi({
      description:
        "Session state. active for open sessions; background task sessions end as completed, failed or timed_out.",
    }),
    createdAt: z.string().openapi({
      description: "When the session was started, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description:
        "When the session was last updated, as an ISO 8601 timestamp.",
    }),
  })
  .openapi("AgentSessionSummary")
  .openapi({ description: "Summary of an agent session." });

export const listAgentChatsResponseSchema = z
  .object({
    sessions: z.array(agentSessionSummarySchema).openapi({
      description:
        "Agent sessions visible to the caller, newest first. Organization API keys only see sessions not owned by a user.",
    }),
  })
  .openapi("ListAgentChatsResponse")
  .openapi({ description: "Recent agent sessions in the workspace." });
