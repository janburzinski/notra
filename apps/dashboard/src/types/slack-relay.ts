import type { slackThreadRepliesResponseSchema } from "@notra/schemas/dashboard/slack-relay";
import type { z } from "zod";

export interface SlackRelayTarget {
  teamId: string;
  channelId: string;
  threadTs: string;
}

export interface SlackRelayInputMode {
  threadUrl: string | null;
}

/** One message of a Slack thread as `conversations.replies` returns it. */
export type SlackThreadReply = NonNullable<
  z.infer<typeof slackThreadRepliesResponseSchema>["messages"]
>[number];
