import type { ChatMessageSlackAuthor } from "@notra/ai/types/chat";
import { Effect } from "effect";
import type {
  SlackInboundMessageContext,
  SlackMessage,
  SlackThreadMessage,
} from "eve/channels/slack";

import type { MirrorUiMessage } from "../types/chat-mirror";
import { claimMirroredChatSession } from "./chat-mirror";
import { resolveSlackAuthors } from "./slack-message-authors";
import { isPublicSlackChannel } from "./slack-public-channel";

const SLACK_MENTION_REGEX = /<@[A-Z0-9]+>/gu;
const RENDERED_MENTION_REGEX = /@U[A-Z0-9]{8,}/gu;
const WHITESPACE_REGEX = /\s+/gu;

function getSlackExternalChannelId(
  teamId: string | undefined,
  channelId: string,
  threadTs: string
) {
  return `${teamId ?? "workspace"}:${channelId}:${threadTs}`;
}

function getSlackMessageText(message: {
  readonly markdown: string;
  readonly text: string;
}) {
  return message.markdown.trim() || message.text.trim();
}

function toSlackThreadUiMessage(
  channelId: string,
  message: SlackThreadMessage,
  authors: ReadonlyMap<string, ChatMessageSlackAuthor>
): MirrorUiMessage | null {
  if (message.botId && !message.isMe) {
    return null;
  }

  const text = getSlackMessageText(message);
  if (!text) {
    return null;
  }

  const author =
    !message.isMe && message.user ? authors.get(message.user) : undefined;
  return {
    id: `slack:${channelId}:${message.ts}`,
    role: message.isMe ? "assistant" : "user",
    parts: [{ type: "text", text }],
    ...(author ? { metadata: { slackAuthor: author } } : {}),
  };
}

function toSlackInboundUiMessage(
  message: SlackMessage,
  author: ChatMessageSlackAuthor | undefined
): MirrorUiMessage | null {
  const text = getSlackMessageText(message);
  if (!text) {
    return null;
  }

  return {
    id: `slack:${message.channelId}:${message.ts}`,
    role: "user",
    parts: [{ type: "text", text }],
    ...(author ? { metadata: { slackAuthor: author } } : {}),
  };
}

/** The sender's profile, falling back to the names the event carries. */
function inboundSlackAuthor(
  message: SlackMessage,
  lookedUp: ChatMessageSlackAuthor | undefined
): ChatMessageSlackAuthor | undefined {
  const userId = message.author?.userId;
  if (!userId) {
    return undefined;
  }
  const name =
    lookedUp?.name ??
    (message.author?.fullName?.trim() || message.author?.userName?.trim());
  return {
    userId,
    ...(name ? { name } : {}),
    ...(lookedUp?.image ? { image: lookedUp.image } : {}),
  };
}

function getSlackChatTitle(message: SlackMessage) {
  const text = getSlackMessageText(message)
    .replace(SLACK_MENTION_REGEX, "")
    .replace(RENDERED_MENTION_REGEX, "")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
  const preview = text.length > 52 ? `${text.slice(0, 49).trimEnd()}...` : text;
  return preview ? `Slack: ${preview}` : "Slack conversation";
}

export function mirrorPublicSlackThread(
  ctx: SlackInboundMessageContext,
  message: SlackMessage,
  organizationId: string
): Effect.Effect<string | null> {
  return Effect.gen(function* () {
    const isPublic = yield* isPublicSlackChannel(ctx, message);
    if (!isPublic) {
      return null;
    }

    const senderId = message.author?.userId;
    const senders = senderId
      ? yield* Effect.promise(() =>
          resolveSlackAuthors(ctx.slack, message.teamId, [senderId])
        )
      : new Map<string, ChatMessageSlackAuthor>();
    const sender = inboundSlackAuthor(
      message,
      senderId ? senders.get(senderId) : undefined
    );

    return yield* claimMirroredChatSession({
      organizationId,
      source: "slack",
      externalChannelId: getSlackExternalChannelId(
        message.teamId,
        message.channelId,
        message.threadTs
      ),
      title: getSlackChatTitle(message),
      inboundMessage: toSlackInboundUiMessage(message, sender),
      loadHistory: async () => {
        await ctx.thread.refresh();
        const threadMessages = ctx.thread.recentMessages;
        const authors = await resolveSlackAuthors(
          ctx.slack,
          message.teamId,
          threadMessages.flatMap((threadMessage) =>
            threadMessage.user && !threadMessage.isMe && !threadMessage.botId
              ? [threadMessage.user]
              : []
          )
        );
        return threadMessages.flatMap((threadMessage) => {
          const uiMessage = toSlackThreadUiMessage(
            message.channelId,
            threadMessage,
            authors
          );
          return uiMessage ? [uiMessage] : [];
        });
      },
    });
  }).pipe(
    Effect.catch((error) =>
      Effect.logWarning("[agent] Slack inbound chat mirror failed", error).pipe(
        Effect.as(null)
      )
    )
  );
}
