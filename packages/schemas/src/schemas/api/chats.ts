import "zod/compile";
import { z } from "@hono/zod-openapi";
import {
  chatModelSchema,
  chatToolApprovalResponseSchema,
  externalChannelLookupSourceSchema,
  externalChannelSourceSchema,
  thinkingLevelSchema,
} from "@notra/ai/schemas/chat";
import { standaloneChatContextSchema } from "@notra/ai/schemas/standalone-chat";

const publicExternalChannelSourceSchema = z.enum([
  "discord",
  "slack",
  "dashboard",
]);

const publicExternalChannelIdSchema = z
  .object({
    source: publicExternalChannelSourceSchema,
    id: z.string().max(200).optional(),
  })
  .refine(
    (value) =>
      value.source === "dashboard" ||
      (typeof value.id === "string" && value.id.length > 0),
    { message: "id is required for discord and slack sources" }
  )
  .openapi("PublicExternalChannelId");

const externalChannelIdSchema = z
  .object({
    source: externalChannelSourceSchema.openapi({
      description:
        "Where the chat is linked, which is a Discord or Slack channel, a dashboard id or an agent.",
    }),
    id: z.string().max(200).optional().openapi({
      description:
        "Channel ID on that platform or the id the chat was tagged with, which is always set for discord and slack and optional for other sources.",
    }),
  })
  .refine(
    (value) =>
      value.source === "dashboard" ||
      value.source === "agent" ||
      (typeof value.id === "string" && value.id.length > 0),
    { message: "id is required for discord and slack sources" }
  )
  .openapi("ExternalChannelId", {
    description:
      "The external channel the chat is linked to, used by GET /v1/chats/by-external.",
  });

export const chatSessionSummarySchema = z
  .object({
    chatId: z.string().openapi({
      description: "The chat's ID, used as chatId in /v1/chats/{chatId}.",
    }),
    title: z.string().openapi({
      description:
        'Title of the chat, written from its first user message, or "New chat" before there is one.',
    }),
    createdAt: z.string().openapi({
      description: "When the chat was created, as an ISO 8601 timestamp.",
    }),
    updatedAt: z.string().openapi({
      description:
        "When the chat last changed, such as a new message, as an ISO 8601 timestamp.",
    }),
    pinnedAt: z.string().nullable().openapi({
      description:
        "When the chat was pinned, as an ISO 8601 timestamp, or null when it isn't pinned.",
    }),
    externalChannelId: externalChannelIdSchema.nullable().optional().openapi({
      description:
        "The external channel the chat is linked to, or null or absent when it isn't linked.",
    }),
  })
  .openapi("ChatSessionSummary", {
    description: "A chat session without its messages.",
  });

const uiMessageSchema = z.unknown().openapi("ChatMessage");

export const getChatParamsSchema = z.object({
  chatId: z
    .string()
    .min(1)
    .openapi({
      param: { name: "chatId", in: "path" },
      example: "chat_abc123",
    }),
});

export const sendChatMessageRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(50_000).optional().openapi({
      description: "The user message to send.",
      example: "Summarize what shipped in the last week.",
    }),
    approvals: z
      .array(chatToolApprovalResponseSchema)
      .min(1)
      .max(50)
      .optional()
      .openapi({
        description:
          "Respond to every pending tool approval in the latest assistant message. Send either message or approvals. Only supported on an existing chat.",
      }),
    model: chatModelSchema.optional().openapi({
      description:
        "Deprecated and ignored. Chats always respond with GLM 5.3 Flash.",
      deprecated: true,
      example: "zai/glm-5.3-flash",
    }),
    enableThinking: z.boolean().optional().openapi({
      description: "Allow the model to reason before answering.",
      example: false,
    }),
    thinkingLevel: thinkingLevelSchema.optional().openapi({
      description:
        "How much reasoning effort to spend when thinking is enabled.",
      example: "medium",
    }),
    timezone: z.string().min(1).max(100).optional().openapi({
      description:
        "IANA time zone used to interpret dates in the conversation.",
      example: "Europe/Berlin",
    }),
    context: z.array(standaloneChatContextSchema).optional().openapi({
      description:
        "Integrations the assistant may use as tools in this chat: connected GitHub repositories, Linear teams, or MCP servers.",
    }),
    externalChannelId: publicExternalChannelIdSchema.optional().openapi({
      description:
        "Link the chat to a Discord or Slack channel, or tag it with your own dashboard id, so it can be found later with GET /v1/chats/by-external.",
    }),
  })
  .refine(
    (value) =>
      (value.message !== undefined) !== (value.approvals !== undefined),
    {
      message: "Provide either message or approvals, but not both",
    }
  )
  .openapi("SendChatMessageRequest");

export const getChatByExternalQuerySchema = z.object({
  source: externalChannelLookupSourceSchema.openapi({
    param: { name: "source", in: "query" },
    description:
      "Source the chat was linked with: a messaging platform, or dashboard for your own id.",
    example: "discord",
  }),
  id: z
    .string()
    .min(1)
    .max(200)
    .openapi({
      param: { name: "id", in: "query" },
      description:
        "Channel ID on that platform, or the id you tagged the chat with.",
      example: "channel_123",
    }),
});

export const sendChatParamsSchema = z.object({
  chatId: z
    .string()
    .min(1)
    .openapi({
      param: { name: "chatId", in: "path" },
      example: "chat_abc123",
    }),
});

export const getChatsResponseSchema = z
  .object({
    chats: z.array(chatSessionSummarySchema).openapi({
      description:
        "Chats with pinned ones first, most recently pinned first, then the rest by most recent activity.",
    }),
  })
  .openapi("GetChatsResponse", {
    description: "The organization's chat sessions, without their messages.",
  });

export const getChatResponseSchema = z
  .object({
    chat: chatSessionSummarySchema,
    messages: z.array(uiMessageSchema).openapi({
      description:
        "The full conversation in AI SDK UI message format, oldest first.",
    }),
  })
  .openapi("GetChatResponse", {
    description: "A chat session with its full message history.",
  });
