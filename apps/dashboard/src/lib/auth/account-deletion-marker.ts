import { redis } from "@notra/ai/utils/redis";

import { ACCOUNT_DELETION_MARKER_TTL_SECONDS } from "@/constants/account-deletion";

const markerKey = (workosUserId: string) => `account-deletion:${workosUserId}`;

/**
 * Marks a WorkOS user whose account is being deleted, so another session
 * can't recreate the local account between the local and WorkOS deletion.
 * "failed" means Redis is configured but couldn't store the marker: the
 * deletion must not start. "unconfigured" means there is no Redis to use.
 */
export async function markAccountDeletion(
  workosUserId: string
): Promise<"marked" | "unconfigured" | "failed"> {
  if (!redis) {
    return "unconfigured";
  }
  try {
    await redis.set(markerKey(workosUserId), "1", {
      ex: ACCOUNT_DELETION_MARKER_TTL_SECONDS,
    });
    return "marked";
  } catch {
    return "failed";
  }
}

/** Lets the user sign in again after the WorkOS deletion failed. */
export async function clearAccountDeletion(workosUserId: string) {
  await redis?.del(markerKey(workosUserId));
}

/** Throws when Redis can't answer; false when Redis isn't configured. */
export async function isAccountDeletionPending(workosUserId: string) {
  if (!redis) {
    return false;
  }
  return (await redis.get(markerKey(workosUserId))) !== null;
}
