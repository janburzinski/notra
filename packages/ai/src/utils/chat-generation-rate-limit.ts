import {
  CHAT_GENERATION_RATE_LIMIT,
  CHAT_GENERATION_USER_RATE_LIMIT,
} from "@notra/ai/constants/rate-limits";
import type { ChatGenerationRateLimit } from "@notra/ai/types/rate-limits";
import { redis } from "@notra/ai/utils/redis";

const ORGANIZATION_PREFIX = "ratelimit:chat-generation";
const USER_PREFIX = "ratelimit:dashboard-chat-generation-user";
const WINDOW_MS = 60_000;

const DUAL_SLIDING_WINDOW_SCRIPT = `
local orgCurrent = KEYS[1]
local orgPrevious = KEYS[2]
local userCurrent = KEYS[3]
local userPrevious = KEYS[4]
local orgLimit = tonumber(ARGV[1])
local userLimit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window = tonumber(ARGV[4])

local function weightedUsage(currentKey, previousKey)
  local current = tonumber(redis.call("GET", currentKey) or "0")
  local previous = tonumber(redis.call("GET", previousKey) or "0")
  local percentageInCurrent = (now % window) / window
  return current + math.floor((1 - percentageInCurrent) * previous)
end

local orgUsed = weightedUsage(orgCurrent, orgPrevious)
local userUsed = weightedUsage(userCurrent, userPrevious)

if orgUsed >= orgLimit then
  return {-1, orgLimit}
end
if userUsed >= userLimit then
  return {-1, userLimit}
end

local orgValue = redis.call("INCR", orgCurrent)
local userValue = redis.call("INCR", userCurrent)
if orgValue == 1 then redis.call("PEXPIRE", orgCurrent, window * 2 + 1000) end
if userValue == 1 then redis.call("PEXPIRE", userCurrent, window * 2 + 1000) end
orgUsed = orgUsed + 1
userUsed = userUsed + 1

local orgRemaining = orgLimit - orgUsed
local userRemaining = userLimit - userUsed
if orgRemaining <= userRemaining then
  return {orgRemaining, orgLimit}
end
return {userRemaining, userLimit}
`;

/**
 * Counts one chat generation against both the organization's and the user's
 * window. `userId` is any stable per-person key, so non-dashboard surfaces can
 * share the organization budget. Without Redis nothing is counted.
 */
export async function consumeChatGenerationRateLimit(
  organizationId: string,
  userId: string
): Promise<ChatGenerationRateLimit> {
  const now = Date.now();
  const window = Math.floor(now / WINDOW_MS);
  const reset = (window + 1) * WINDOW_MS;

  if (!redis) {
    const limit = CHAT_GENERATION_USER_RATE_LIMIT.requests;
    return { success: true, limit, remaining: limit, reset };
  }

  const [remaining, limit] = await redis.eval<
    [number, number, number, number],
    [number, number]
  >(
    DUAL_SLIDING_WINDOW_SCRIPT,
    [
      `${ORGANIZATION_PREFIX}:${organizationId}:${window}`,
      `${ORGANIZATION_PREFIX}:${organizationId}:${window - 1}`,
      `${USER_PREFIX}:${organizationId}:${userId}:${window}`,
      `${USER_PREFIX}:${organizationId}:${userId}:${window - 1}`,
    ],
    [
      CHAT_GENERATION_RATE_LIMIT.requests,
      CHAT_GENERATION_USER_RATE_LIMIT.requests,
      now,
      WINDOW_MS,
    ]
  );

  return {
    success: remaining >= 0,
    limit,
    remaining: Math.max(0, remaining),
    reset,
  };
}
