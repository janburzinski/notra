import { redis } from "@notra/ai/utils/redis";
import { logError, logWarn } from "@notra/ai/utils/server-log";
import type {
  SlackChannelState,
  SlackEventContext,
  SlackHandle,
} from "eve/channels/slack";
import type { SessionContext } from "eve/context";

import {
  SLACK_IGNORED_REACTION_ERRORS,
  SLACK_WORKING_REACTION,
  SLACK_WORKING_REACTIONS_KEY_ATTRIBUTE,
  SLACK_WORKING_REACTIONS_TTL_SECONDS,
} from "../constants/slack";
import type {
  NotraSlackStateExtras,
  SlackMessageRef,
  SlackSessionSender,
} from "../types/slack";
import { getNotraSlackState } from "./slack-state";

let missingScopeLogged = false;

/** Best-effort: never throws, so reactions can't break or fail a turn. */
async function requestWorkingReaction(
  slack: Pick<SlackHandle, "request">,
  method: "reactions.add" | "reactions.remove",
  message: SlackMessageRef
): Promise<void> {
  try {
    const response = await slack.request(method, {
      channel: message.channelId,
      timestamp: message.ts,
      name: SLACK_WORKING_REACTION,
    });
    const error = response.ok ? undefined : response.error;
    if (!error || SLACK_IGNORED_REACTION_ERRORS.has(error)) {
      return;
    }
    if (error === "missing_scope") {
      // Installs from before reactions:write was requested must reconnect.
      if (!missingScopeLogged) {
        missingScopeLogged = true;
        logWarn("Slack working reaction needs the reactions:write scope", {
          method,
        });
      }
      return;
    }
    logWarn("Slack working reaction failed", { method, error });
  } catch (error) {
    logError("Slack working reaction failed", error, { method });
  }
}

// "channel|ts" stays a string: Upstash JSON-parses values it reads back, which
// would turn a bare ts into a lossy number.
function toMember(message: SlackMessageRef): string {
  return `${message.channelId}|${message.ts}`;
}

function fromMember(member: unknown): SlackMessageRef | null {
  if (typeof member !== "string") {
    return null;
  }
  const [channelId, ts] = member.split("|");
  return channelId && ts ? { channelId, ts } : null;
}

/**
 * Reacts with 👀 and records the message in its thread's set, so whichever
 * turn ends up handling it can clear it, even when several messages are
 * delivered together. Returns the set key for the turn's auth, or `undefined`
 * when the message can't be tracked (and therefore isn't reacted to).
 */
export async function addSlackWorkingReaction(
  slack: Pick<SlackHandle, "request">,
  message: SlackMessageRef & { installationTeamId: string; threadTs: string }
): Promise<string | undefined> {
  if (!redis) {
    return undefined;
  }
  const key = `slack:working-reactions:${message.installationTeamId}:${message.channelId}:${message.threadTs}`;
  try {
    await redis.sadd(key, toMember(message));
    await redis.expire(key, SLACK_WORKING_REACTIONS_TTL_SECONDS);
  } catch (error) {
    logError("Slack working reaction tracking failed", error);
    return undefined;
  }
  await requestWorkingReaction(slack, "reactions.add", message);
  return key;
}

async function removeSlackWorkingReaction(
  slack: Pick<SlackHandle, "request">,
  key: string,
  message: SlackMessageRef
): Promise<void> {
  await Promise.all([
    requestWorkingReaction(slack, "reactions.remove", message),
    redis?.srem(key, toMember(message)).catch((error: unknown) => {
      logError("Slack working reaction tracking failed", error);
    }),
  ]);
}

/** Removes the 👀 again when the session refuses the message it marked. */
export function withWorkingReactionRelease(
  session: SlackSessionSender,
  slack: Pick<SlackHandle, "request">,
  key: string,
  message: SlackMessageRef
): SlackSessionSender {
  return {
    async send(content, options) {
      let result: Awaited<ReturnType<SlackSessionSender["send"]>>;
      try {
        result = await session.send(content, options);
      } catch (error) {
        await removeSlackWorkingReaction(slack, key, message);
        throw error;
      }
      if (result.status !== "accepted") {
        await removeSlackWorkingReaction(slack, key, message);
      }
      return result;
    },
  };
}

/** Remembers the running turn's reaction set so events without a ctx can clear it. */
export function trackSlackWorkingReactions(
  state: SlackChannelState & NotraSlackStateExtras,
  ctx: SessionContext
): void {
  const key =
    ctx.session.auth.current?.attributes?.[
      SLACK_WORKING_REACTIONS_KEY_ATTRIBUTE
    ];
  if (
    typeof key !== "string" ||
    state.notraWorkingReactionKeys?.includes(key)
  ) {
    return;
  }
  state.notraWorkingReactionKeys = [
    ...(state.notraWorkingReactionKeys ?? []),
    key,
  ];
}

export async function clearSlackWorkingReactions(
  channel: Pick<SlackEventContext, "slack" | "state">,
  ctx?: SessionContext
): Promise<void> {
  const state = getNotraSlackState(channel.state);
  if (ctx) {
    trackSlackWorkingReactions(state, ctx);
  }
  const keys = state.notraWorkingReactionKeys ?? [];
  const store = redis;
  if (keys.length === 0 || !store) {
    return;
  }
  await Promise.all(
    keys.map(async (key) => {
      let members: unknown[];
      try {
        members = await store.smembers(key);
        if (members.length > 0) {
          await store.srem(key, ...members);
        }
      } catch (error) {
        logError("Slack working reaction tracking failed", error);
        return;
      }
      await Promise.all(
        members
          .map(fromMember)
          .filter((message) => message !== null)
          .map((message) =>
            requestWorkingReaction(channel.slack, "reactions.remove", message)
          )
      );
    })
  );
}
