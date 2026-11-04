import {
  DATABUDDY_VISITOR_DELETION_TIMEOUT_MS,
  DATABUDDY_VISITOR_DELETION_URL,
} from "@/constants/analytics";

/**
 * Erases what Databuddy stores for a user the dashboard identified with
 * `identify(userId)`: events, identity links, profile traits and recordings.
 * Needs `DATABUDDY_API_KEY` to be allowed to manage the dashboard website.
 * Does nothing when Databuddy isn't configured; throws when the request fails.
 */
export async function deleteDatabuddyVisitor(userId: string) {
  const apiKey = process.env.DATABUDDY_API_KEY;
  const websiteId = process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID;
  if (!(apiKey && websiteId)) {
    return;
  }
  const response = await fetch(DATABUDDY_VISITOR_DELETION_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ websiteId, visitorId: userId }),
    signal: AbortSignal.timeout(DATABUDDY_VISITOR_DELETION_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Databuddy visitor deletion for user ${userId} failed with status ${response.status}`
    );
  }
}
