import type { ChatMessageSlackAuthor } from "@notra/ai/types/chat";
import type { SlackHandle } from "eve/channels/slack";

import {
  SLACK_AUTHOR_CACHE_MAX_ENTRIES,
  SLACK_AUTHOR_CACHE_TTL_MS,
} from "../constants/chat-mirror";
import { slackUserInfoSchema } from "../schemas/slack-user";

const authorCache = new Map<
  string,
  { author: ChatMessageSlackAuthor; expiresAt: number }
>();

function firstName(...names: (string | undefined)[]): string | undefined {
  for (const name of names) {
    const trimmed = name?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

async function lookUpSlackAuthor(
  slack: Pick<SlackHandle, "request">,
  userId: string
): Promise<ChatMessageSlackAuthor> {
  try {
    const parsed = slackUserInfoSchema.safeParse(
      await slack.request("users.info", { user: userId })
    );
    const user = parsed.success && parsed.data.ok ? parsed.data.user : null;
    if (!user) {
      return { userId };
    }
    const name = firstName(
      user.profile?.display_name,
      user.profile?.real_name,
      user.real_name,
      user.name
    );
    const image = user.profile?.image_72;
    return {
      userId,
      ...(name ? { name } : {}),
      ...(image ? { image } : {}),
    };
  } catch {
    // People from other workspaces (Slack Connect) can't always be looked up.
    return { userId };
  }
}

/**
 * Names and photos of the Slack people in a thread, so the dashboard can show
 * who wrote each mirrored message. Lookups are cached per workspace; a failed
 * lookup still returns the user id and is retried next time.
 */
export async function resolveSlackAuthors(
  slack: Pick<SlackHandle, "request">,
  teamId: string | undefined,
  userIds: readonly string[]
): Promise<Map<string, ChatMessageSlackAuthor>> {
  const now = Date.now();
  const authors = new Map<string, ChatMessageSlackAuthor>();
  await Promise.all(
    [...new Set(userIds)].map(async (userId) => {
      const key = `${teamId ?? "workspace"}:${userId}`;
      const cached = authorCache.get(key);
      if (cached && cached.expiresAt > now) {
        authors.set(userId, cached.author);
        return;
      }
      const author = await lookUpSlackAuthor(slack, userId);
      authors.set(userId, author);
      if (!author.name) {
        return;
      }
      authorCache.delete(key);
      if (authorCache.size >= SLACK_AUTHOR_CACHE_MAX_ENTRIES) {
        const oldest = authorCache.keys().next().value;
        if (oldest !== undefined) {
          authorCache.delete(oldest);
        }
      }
      authorCache.set(key, {
        author,
        expiresAt: now + SLACK_AUTHOR_CACHE_TTL_MS,
      });
    })
  );
  return authors;
}

/** Forgets a workspace's people once it removes the app. */
export function forgetSlackAuthors(teamId: string | undefined) {
  const prefix = `${teamId ?? "workspace"}:`;
  for (const key of authorCache.keys()) {
    if (key.startsWith(prefix)) {
      authorCache.delete(key);
    }
  }
}
