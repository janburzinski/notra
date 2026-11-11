import {
  SLACK_API_BASE_URL,
  SLACK_REQUEST_TIMEOUT_MS,
} from "@notra/ai/constants/slack";
import { getSlackIntegrationBotToken } from "@notra/ai/integrations/slack-workspace";
import { redis } from "@notra/ai/utils/redis";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { members, slackIntegrations, users } from "@notra/db/schema";
import { and, eq, sql } from "drizzle-orm";

import {
  SLACK_MEMBER_CACHE_MAX_ENTRIES,
  SLACK_MEMBER_CACHE_TTL_MS,
  SLACK_MISSING_SCOPE_KEY_PREFIX,
  SLACK_MISSING_SCOPE_TTL_SECONDS,
} from "@/constants/slack-integration";
import { slackUserInfoResponseSchema } from "@/schemas/autopilot-slack";
import type {
  SlackMemberIdentity,
  SlackMemberResolution,
} from "@/types/slack-integration";

const cache = new Map<
  string,
  { value: SlackMemberIdentity; expiresAt: number }
>();

function readCache(key: string) {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: SlackMemberIdentity) {
  if (cache.size >= SLACK_MEMBER_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(key, { value, expiresAt: Date.now() + SLACK_MEMBER_CACHE_TTL_MS });
}

function missingScopeKey(integrationId: string) {
  return `${SLACK_MISSING_SCOPE_KEY_PREFIX}${integrationId}`;
}

async function setMissingScope(integrationId: string, missing: boolean) {
  if (!redis) {
    return;
  }
  try {
    if (missing) {
      await redis.set(missingScopeKey(integrationId), "1", {
        ex: SLACK_MISSING_SCOPE_TTL_SECONDS,
      });
    } else {
      await redis.del(missingScopeKey(integrationId));
    }
  } catch (error) {
    logError("Slack missing scope flag update failed", error, {
      integrationId,
    });
  }
}

export async function listSlackIntegrationsMissingScopes(
  integrationIds: string[]
): Promise<Set<string>> {
  if (!redis || integrationIds.length === 0) {
    return new Set();
  }
  try {
    const flags = await redis.mget<(string | number | null)[]>(
      ...integrationIds.map(missingScopeKey)
    );
    return new Set(integrationIds.filter((_, index) => flags[index] !== null));
  } catch (error) {
    logError("Slack missing scope flag read failed", error, {});
    return new Set();
  }
}

export function clearSlackIntegrationMissingScopes(integrationId: string) {
  return setMissingScope(integrationId, false);
}

export function clearSlackMemberCache() {
  cache.clear();
}

async function lookupSlackIdentity(
  organizationId: string,
  teamId: string,
  slackUserId: string
): Promise<SlackMemberIdentity> {
  const integration = await db.query.slackIntegrations.findFirst({
    columns: { id: true, encryptedBotToken: true },
    where: and(
      eq(slackIntegrations.organizationId, organizationId),
      eq(slackIntegrations.slackTeamId, teamId),
      eq(slackIntegrations.enabled, true)
    ),
  });
  if (!integration) {
    return { status: "unknown" };
  }
  const response = await fetch(
    `${SLACK_API_BASE_URL}/users.info?user=${encodeURIComponent(slackUserId)}`,
    {
      headers: {
        authorization: `Bearer ${getSlackIntegrationBotToken(integration)}`,
      },
      signal: AbortSignal.timeout(SLACK_REQUEST_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    throw new Error(`Slack users.info failed with ${response.status}`);
  }
  const parsed = slackUserInfoResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    return { status: "unknown" };
  }
  if (!parsed.data.ok) {
    if (parsed.data.error === "missing_scope") {
      await setMissingScope(integration.id, true);
      return { status: "missing_scope" };
    }
    return { status: "unknown" };
  }
  await setMissingScope(integration.id, false);
  const user = parsed.data.user;
  const email = user?.profile?.email?.trim().toLowerCase();
  if (
    !(user && email) ||
    user.team_id !== teamId ||
    user.deleted ||
    user.is_bot ||
    user.is_restricted ||
    user.is_ultra_restricted
  ) {
    return { status: "unknown" };
  }
  return { status: "verified", email };
}

async function findMember(
  organizationId: string,
  email: string
): Promise<SlackMemberResolution> {
  const [member] = await db
    .select({ userId: members.userId, role: members.role })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(
      and(
        eq(members.organizationId, organizationId),
        sql`lower(${users.email}) = ${email}`,
        eq(users.emailVerified, true)
      )
    )
    .limit(1);
  return member
    ? { status: "member", userId: member.userId, email, role: member.role }
    : { status: "unknown" };
}

export async function resolveSlackMember(
  organizationId: string,
  teamId: string,
  slackUserId: string
): Promise<SlackMemberResolution> {
  const key = `${organizationId}:${teamId}:${slackUserId}`;
  try {
    let identity = readCache(key);
    if (!identity) {
      identity = await lookupSlackIdentity(organizationId, teamId, slackUserId);
      writeCache(key, identity);
    }
    return identity.status === "verified"
      ? await findMember(organizationId, identity.email)
      : identity;
  } catch (error) {
    logError("Slack member lookup failed", error, { organizationId });
    return { status: "unknown" };
  }
}
