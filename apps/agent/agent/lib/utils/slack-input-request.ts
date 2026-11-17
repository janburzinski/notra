import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { posts } from "@notra/db/schema";
import {
  getLinkedTwitterAccounts,
  isTwitterPublishConfigured,
} from "@notra/tools/utils/social-accounts";
import { and, eq } from "drizzle-orm";
import type { SlackEventContext, SlackPostInput } from "eve/channels/slack";

import { POST_TO_X_CONFIRM_ACTION_PREFIX } from "../constants/slack-post-x";
import { resolveSlackInstallation } from "./slack-installation";
import { savePendingPostToX } from "./slack-post-x";

async function createTwitterDraftPost(
  markdown: string,
  callId: string,
  channel: SlackEventContext,
  requestedBy: string | undefined
): Promise<SlackPostInput> {
  const linkedAccount = await resolveLinkedTwitterAccount(
    channel,
    markdown,
    callId,
    requestedBy
  );
  const text = (value: string) => ({
    type: "plain_text" as const,
    text: value,
  });
  const action = linkedAccount
    ? {
        type: "button",
        action_id: `${POST_TO_X_CONFIRM_ACTION_PREFIX}:${callId}`,
        text: text(`Post to @${linkedAccount.username}`),
        value: JSON.stringify({ callId, username: linkedAccount.username }),
      }
    : {
        type: "button",
        action_id: `notra_open_x:${callId}`,
        text: text("Open X composer"),
        url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(markdown)}`,
        value: "open_x",
      };
  return {
    text: "Tweet saved as a draft",
    blocks: [
      { type: "section", text: text("Tweet saved as a draft") },
      { type: "actions", elements: [action] },
    ],
  };
}

async function resolveLinkedTwitterAccount(
  channel: SlackEventContext,
  markdown: string,
  callId: string,
  requestedBy: string | undefined
) {
  if (!isTwitterPublishConfigured()) {
    return null;
  }
  const teamId = channel.state.installationTeamId;
  if (!teamId) {
    return null;
  }
  try {
    const installation = await resolveSlackInstallation(teamId);
    if (!installation) {
      return null;
    }
    const accounts = await getLinkedTwitterAccounts(
      installation.organizationId
    );
    const account = accounts.at(0);
    if (!account) {
      return null;
    }
    const stored = await savePendingPostToX(callId, {
      organizationId: installation.organizationId,
      accountId: account.id,
      username: account.username,
      text: markdown,
      requestedBy,
    });
    return stored ? account : null;
  } catch (error) {
    logError("[agent] Failed to resolve linked X account", error, {
      slackTeamId: teamId,
      callId,
    });
    return null;
  }
}

export async function offerSavedTweetPublishing(
  channel: SlackEventContext,
  organizationId: string,
  postId: string,
  callId: string,
  requestedBy: string | undefined
): Promise<boolean> {
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), eq(posts.organizationId, organizationId)),
    columns: { markdown: true },
  });
  if (!post?.markdown) {
    return false;
  }
  await channel.thread.post(post.markdown);
  await channel.thread.post(
    await createTwitterDraftPost(post.markdown, callId, channel, requestedBy)
  );
  return true;
}
