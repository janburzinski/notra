import { SLACK_RELAY_EVENT_TYPE } from "@notra/ai/constants/chat";
import {
  SLACK_API_BASE_URL,
  SLACK_REQUEST_TIMEOUT_MS,
} from "@notra/ai/constants/slack";
import type {
  ChatMessageSlackAuthor,
  ChatUIMessage,
} from "@notra/ai/types/chat";
import {
  slackAuthTestResponseSchema,
  slackConversationInfoResponseSchema,
  slackThreadRepliesResponseSchema,
  slackUserProfileResponseSchema,
} from "@notra/schemas/dashboard/slack-relay";

import {
  SLACK_ASSISTANT_NAME,
  SLACK_THREAD_BACKFILL_LIMIT,
} from "@/constants/slack-integration";
import type { SlackRelayTarget, SlackThreadReply } from "@/types/slack-relay";
import { slackMrkdwnToMarkdown } from "@/utils/slack-mrkdwn";

async function callSlack(
  token: string,
  method: string,
  params: Record<string, string>
): Promise<unknown> {
  const response = await fetch(
    `${SLACK_API_BASE_URL}/${method}?${new URLSearchParams(params).toString()}`,
    {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(SLACK_REQUEST_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw new Error(`Slack ${method} failed with ${response.status}`);
  }
  return response.json();
}

async function lookUpSlackAuthor(
  token: string,
  userId: string
): Promise<ChatMessageSlackAuthor> {
  try {
    const parsed = slackUserProfileResponseSchema.safeParse(
      await callSlack(token, "users.info", { user: userId })
    );
    const user = parsed.success && parsed.data.ok ? parsed.data.user : null;
    const name = [
      user?.profile?.display_name,
      user?.profile?.real_name,
      user?.real_name,
      user?.name,
    ]
      .map((value) => value?.trim())
      .find(Boolean);
    const image = user?.profile?.image_72;
    return {
      userId,
      ...(name ? { name } : {}),
      ...(image ? { image } : {}),
    };
  } catch {
    // People from another workspace (Slack Connect) can't always be looked up.
    return { userId };
  }
}

/**
 * Every reply in the thread up to the chat's message cap, following Slack's
 * cursor across pages. Null when Slack refuses the thread.
 */
async function readSlackReplies(
  token: string,
  target: SlackRelayTarget
): Promise<SlackThreadReply[] | null> {
  const replies: SlackThreadReply[] = [];
  let cursor: string | undefined;
  do {
    const page = slackThreadRepliesResponseSchema.safeParse(
      await callSlack(token, "conversations.replies", {
        channel: target.channelId,
        ts: target.threadTs,
        limit: String(SLACK_THREAD_BACKFILL_LIMIT - replies.length),
        ...(cursor ? { cursor } : {}),
      })
    );
    if (!(page.success && page.data.ok)) {
      return null;
    }
    replies.push(...(page.data.messages ?? []));
    cursor = page.data.response_metadata?.next_cursor || undefined;
  } while (cursor && replies.length < SLACK_THREAD_BACKFILL_LIMIT);
  return replies.slice(0, SLACK_THREAD_BACKFILL_LIMIT);
}

/**
 * Reads a Slack thread into chat messages the way the agent mirrors them:
 * people's messages carry who wrote them, Notra's replies are the assistant's,
 * messages relayed from the dashboard keep their sender, other bots are left
 * out. Returns null when the channel is private or the thread can't be read.
 */
export async function readSlackThread(
  token: string,
  target: SlackRelayTarget
): Promise<ChatUIMessage[] | null> {
  const [info, identity, threadMessages] = await Promise.all([
    callSlack(token, "conversations.info", { channel: target.channelId }),
    callSlack(token, "auth.test", {}),
    readSlackReplies(token, target),
  ]);
  const channel = slackConversationInfoResponseSchema.safeParse(info);
  const bot = slackAuthTestResponseSchema.safeParse(identity);
  // The agent only mirrors public channels; a channel made private since
  // stays out of the dashboard.
  if (
    !(channel.success && channel.data.ok && channel.data.channel) ||
    channel.data.channel.is_private ||
    channel.data.channel.is_im ||
    channel.data.channel.is_mpim
  ) {
    return null;
  }
  if (!(bot.success && bot.data.ok && threadMessages)) {
    return null;
  }
  const botUserId = bot.data.user_id;
  const botId = bot.data.bot_id;

  const isFromNotra = (message: (typeof threadMessages)[number]) =>
    Boolean(
      (botId && message.bot_id === botId) ||
      (botUserId && message.user === botUserId)
    );
  const peopleIds = [
    ...new Set(
      threadMessages.flatMap((message) =>
        message.user && !message.bot_id && !isFromNotra(message)
          ? [message.user]
          : []
      )
    ),
  ];
  const authors = new Map(
    await Promise.all(
      peopleIds.map(
        async (userId) =>
          [userId, await lookUpSlackAuthor(token, userId)] as const
      )
    )
  );
  const nameOf = (userId: string) =>
    userId === botUserId ? SLACK_ASSISTANT_NAME : authors.get(userId)?.name;

  return threadMessages.flatMap((message): ChatUIMessage[] => {
    const id = `slack:${target.channelId}:${message.ts}`;
    if (isFromNotra(message)) {
      const relay =
        message.metadata?.event_type === SLACK_RELAY_EVENT_TYPE
          ? message.metadata.event_payload
          : undefined;
      if (relay?.text) {
        const name = relay.user_name?.trim();
        return [
          {
            id,
            role: "user",
            parts: [{ type: "text", text: relay.text }],
            metadata: {
              slackAuthor: {
                userId: botUserId ?? "notra",
                ...(name ? { name } : {}),
              },
            },
          },
        ];
      }
      const text = slackMrkdwnToMarkdown(message.text ?? "", nameOf);
      return text
        ? [{ id, role: "assistant", parts: [{ type: "text", text }] }]
        : [];
    }
    if (message.bot_id || !message.user) {
      return [];
    }
    const text = slackMrkdwnToMarkdown(message.text ?? "", nameOf);
    const author = authors.get(message.user);
    return text
      ? [
          {
            id,
            role: "user",
            parts: [{ type: "text", text }],
            ...(author ? { metadata: { slackAuthor: author } } : {}),
          },
        ]
      : [];
  });
}
