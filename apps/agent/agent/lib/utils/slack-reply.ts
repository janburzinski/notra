import { logWarn } from "@notra/ai/utils/server-log";
import type {
  SlackContext,
  SlackEventContext,
  SlackMessage,
} from "eve/channels/slack";

import {
  SLACK_LONG_REPLY_NOTICE,
  SLACK_MARKDOWN_TEXT_MAX_LENGTH,
} from "../constants/slack";

/** Splits text into Slack-sized chunks without breaking a surrogate pair. */
function chunkSlackText(text: string): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + SLACK_MARKDOWN_TEXT_MAX_LENGTH, text.length);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd8_00 && code <= 0xdb_ff) {
      end -= 1;
    }
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}

/**
 * Posts a reply, falling back to a Markdown snippet when Slack would reject it
 * as too long, and to several messages when the upload fails.
 */
export async function postSlackReply(
  channel: Pick<SlackEventContext, "thread" | "slack">,
  text: string
): Promise<void> {
  if (text.length <= SLACK_MARKDOWN_TEXT_MAX_LENGTH) {
    await channel.thread.post(text);
    return;
  }
  const inThread = channel.slack.threadTs.length > 0;
  try {
    // Outside a thread the notice creates one for the upload to land in.
    if (!inThread) {
      await channel.thread.post(SLACK_LONG_REPLY_NOTICE);
    }
    await channel.slack.uploadFiles(
      [
        {
          data: new Blob([text], { type: "text/markdown" }),
          filename: "notra-response.md",
          mimeType: "text/markdown",
        },
      ],
      {
        snippetType: "markdown",
        ...(inThread ? { initialComment: SLACK_LONG_REPLY_NOTICE } : {}),
      }
    );
  } catch {
    for (const chunk of chunkSlackText(text)) {
      await channel.thread.post(chunk);
    }
  }
}

/** Appends an error id so support can trace the failure in the logs. */
export function withErrorId(message: string, errorId: string | null): string {
  return errorId ? `${message}\n\n_Error id: \`${errorId}\`_` : message;
}

/**
 * Shows `text` to one person in the message's thread. eve's
 * `thread.postEphemeral` only threads it once a session thread exists, so a
 * reply to a new top-level mention would otherwise land in the channel.
 */
export async function postSlackThreadEphemeral(
  ctx: Pick<SlackContext, "slack">,
  message: Pick<SlackMessage, "channelId" | "threadTs">,
  userId: string,
  text: string
): Promise<void> {
  const response = await ctx.slack.request("chat.postEphemeral", {
    channel: message.channelId,
    thread_ts: message.threadTs,
    user: userId,
    markdown_text: text,
  });
  if (!response.ok) {
    logWarn("Slack ephemeral reply failed", { error: response.error });
  }
}
