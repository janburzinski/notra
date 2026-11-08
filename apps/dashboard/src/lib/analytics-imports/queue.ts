import { ANALYTICS_IMPORT_ACTIVE_STATUSES } from "@notra/db/constants/analytics-imports";
import { db } from "@notra/db/drizzle";
import { analyticsImports } from "@notra/db/schema";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";

import { ANALYTICS_IMPORT_QUEUE_POLL_SECONDS } from "@/constants/analytics-imports";
import type {
  AnalyticsImportRow,
  AnalyticsImportTurn,
} from "@/types/analytics-imports";

import { wakeImportRun } from "./runs";

/**
 * Imports from one account run one at a time, in the order they were
 * created, so they never share the provider's request budget. Only active
 * imports hold a place: a failed or deleted one frees the queue at once.
 */
function activeOn(connectionIds: string[]) {
  return db.query.analyticsImports.findMany({
    columns: {
      id: true,
      connectionId: true,
      externalSiteRef: true,
      externalSiteLabel: true,
    },
    where: and(
      inArray(analyticsImports.connectionId, connectionIds),
      inArray(analyticsImports.status, [...ANALYTICS_IMPORT_ACTIVE_STATUSES])
    ),
    orderBy: [asc(analyticsImports.createdAt), asc(analyticsImports.id)],
  });
}

/** Whether the import may start, or which import from its account runs first. */
export async function importQueueTurn(
  importId: string
): Promise<AnalyticsImportTurn> {
  const row = await db.query.analyticsImports.findFirst({
    columns: { id: true, connectionId: true },
    where: eq(analyticsImports.id, importId),
  });
  if (!row?.connectionId) {
    return { status: "ready" };
  }
  const queue = await activeOn([row.connectionId]);
  const place = queue.findIndex((item) => item.id === importId);
  return place > 0
    ? {
        status: "waiting",
        retryAfterSeconds: ANALYTICS_IMPORT_QUEUE_POLL_SECONDS,
      }
    : { status: "ready" };
}

/** For each queued import, the source label of the import just before it. */
export async function queuedBehind(
  rows: readonly AnalyticsImportRow[]
): Promise<Map<string, string>> {
  const connectionIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.status === "pending" && row.connectionId ? [row.connectionId] : []
      )
    ),
  ];
  const waiting = new Map<string, string>();
  if (connectionIds.length === 0) {
    return waiting;
  }
  const active = await activeOn(connectionIds);
  for (const row of rows) {
    if (row.status !== "pending" || !row.connectionId) {
      continue;
    }
    const queue = active.filter(
      (item) => item.connectionId === row.connectionId
    );
    const ahead = queue[queue.findIndex((item) => item.id === row.id) - 1];
    if (ahead) {
      waiting.set(row.id, ahead.externalSiteLabel ?? ahead.externalSiteRef);
    }
  }
  return waiting;
}

/**
 * Wakes the next queued import of an account once the one before it has
 * finished, failed or been deleted. Best effort: a queued run that misses
 * the wake-up still checks again after its poll interval.
 */
export async function wakeQueuedImport(
  connectionId: string | null
): Promise<void> {
  if (!connectionId) {
    return;
  }
  try {
    const next = await db.query.analyticsImports.findFirst({
      columns: { workflowRunId: true },
      where: and(
        eq(analyticsImports.connectionId, connectionId),
        eq(analyticsImports.status, "pending"),
        isNotNull(analyticsImports.workflowRunId)
      ),
      orderBy: [asc(analyticsImports.createdAt), asc(analyticsImports.id)],
    });
    if (next?.workflowRunId) {
      await wakeImportRun(next.workflowRunId);
    }
  } catch (error) {
    console.error("analytics_imports.queue_wake_failed", {
      connectionId,
      error: error instanceof Error ? error.message : error,
    });
  }
}
