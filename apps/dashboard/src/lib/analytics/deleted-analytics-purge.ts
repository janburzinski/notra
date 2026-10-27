import { publishQstashRouteMessage } from "@notra/ai/qstash/triggers";
import { logError } from "@notra/ai/utils/server-log";
import {
  purgeDeletedOrganizationAnalytics,
  purgeDeletedSiteAnalytics,
} from "@notra/analytics/tinybird/purge";
import { isDemoMode } from "@notra/utils/demo-mode";

import {
  DELETED_ANALYTICS_PURGE_DELAY_MS,
  DELETED_ANALYTICS_PURGE_ROUTE_PATH,
} from "@/constants/deleted-analytics-purge";
import type { DeletedAnalyticsPurgeInput } from "@/types/deleted-analytics-purge";

export function runDeletedAnalyticsPurge({
  organizationId,
  siteId,
}: DeletedAnalyticsPurgeInput): Promise<void> {
  return siteId
    ? purgeDeletedSiteAnalytics({ organizationId, siteId })
    : purgeDeletedOrganizationAnalytics({ organizationId });
}

/**
 * Purges right away, then queues a second purge after the ingest flush window
 * so rows buffered at deletion time are removed too. QStash retries the
 * queued purge, which also covers an immediate purge that failed.
 */
export async function purgeDeletedAnalytics(
  input: DeletedAnalyticsPurgeInput
): Promise<void> {
  await Promise.all([
    runDeletedAnalyticsPurge(input).catch((error) => {
      logError("[Analytics Purge] Immediate purge failed", error, input);
    }),
    scheduleDeletedAnalyticsPurge(input).catch((error) => {
      logError("[Analytics Purge] Failed to queue delayed purge", error, input);
    }),
  ]);
}

async function scheduleDeletedAnalyticsPurge(
  input: DeletedAnalyticsPurgeInput
): Promise<void> {
  if (isDemoMode() || !process.env.QSTASH_TOKEN) {
    return;
  }
  await publishQstashRouteMessage({
    path: DELETED_ANALYTICS_PURGE_ROUTE_PATH,
    body: input,
    notBefore: new Date(Date.now() + DELETED_ANALYTICS_PURGE_DELAY_MS),
    deduplicationId: `analytics-purge-${input.organizationId}-${input.siteId ?? "org"}`,
  });
}
