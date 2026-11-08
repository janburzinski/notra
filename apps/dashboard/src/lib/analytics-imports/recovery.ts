import { ANALYTICS_IMPORT_ACTIVE_STATUSES } from "@notra/db/constants/analytics-imports";
import { db } from "@notra/db/drizzle";
import { analyticsImports } from "@notra/db/schema";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";

import {
  ANALYTICS_IMPORT_LOST_ERROR,
  ANALYTICS_IMPORT_LOST_UPLOAD_ERROR,
  ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS,
  ANALYTICS_IMPORT_RECOVERY_BATCH,
  ANALYTICS_IMPORT_STALE_MS,
} from "@/constants/analytics-imports";
import { startAnalyticsImportRun } from "@/lib/workflows/start";
import type {
  AnalyticsImportRecoveryResult,
  AnalyticsImportRow,
} from "@/types/analytics-imports";

import { setImportWorkflowRun } from "./imports";
import { failAnalyticsImport } from "./runner";
import { readImportRunState } from "./runs";

/** A run that ended or vanished while its import still reads as active. */
async function isRunLost(runId: string): Promise<boolean> {
  const state = await readImportRunState(runId);
  return state !== "pending" && state !== "running";
}

/**
 * Starts a new run for a lost import; planning resumes at its first
 * unfinished chunk. The attempt is counted before the start, so an import
 * whose runs keep getting lost fails instead of restarting forever.
 */
async function restartImport(row: AnalyticsImportRow): Promise<boolean> {
  const [claimed] = await db
    .update(analyticsImports)
    .set({ recoveryAttempts: sql`${analyticsImports.recoveryAttempts} + 1` })
    .where(
      and(
        eq(analyticsImports.id, row.id),
        eq(analyticsImports.recoveryAttempts, row.recoveryAttempts),
        inArray(analyticsImports.status, [...ANALYTICS_IMPORT_ACTIVE_STATUSES])
      )
    )
    .returning({ id: analyticsImports.id });
  if (!claimed) {
    return false;
  }
  const run = await startAnalyticsImportRun({ importId: row.id });
  await setImportWorkflowRun(row.id, run.runId);
  return true;
}

/**
 * Finds active imports nobody has touched for a while and checks their
 * workflow run. A run that is still pending or running (also while it
 * sleeps through a rate limit or waits in its account's queue) is left
 * alone. A lost run is restarted a few times, then the import fails with a
 * message, which frees its days and its account's queue. An export held in
 * memory (no object storage) can't be read again, so that import fails.
 */
export async function recoverAnalyticsImports(
  now = Date.now()
): Promise<AnalyticsImportRecoveryResult> {
  const rows = await db.query.analyticsImports.findMany({
    where: and(
      inArray(analyticsImports.status, [...ANALYTICS_IMPORT_ACTIVE_STATUSES]),
      lt(analyticsImports.updatedAt, new Date(now - ANALYTICS_IMPORT_STALE_MS))
    ),
    orderBy: [asc(analyticsImports.updatedAt)],
    limit: ANALYTICS_IMPORT_RECOVERY_BATCH,
  });
  const result: AnalyticsImportRecoveryResult = {
    checked: rows.length,
    restarted: 0,
    failed: 0,
  };
  for (const row of rows) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one import at a time keeps the sweep's load small
      if (row.workflowRunId && !(await isRunLost(row.workflowRunId))) {
        continue;
      }
      const inline =
        !row.workflowRunId &&
        row.provider === "plausible_csv" &&
        !row.uploadObjectKey;
      if (
        inline ||
        row.recoveryAttempts >= ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS
      ) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- see above
        await failAnalyticsImport(
          row.id,
          inline
            ? ANALYTICS_IMPORT_LOST_UPLOAD_ERROR
            : ANALYTICS_IMPORT_LOST_ERROR
        );
        result.failed += 1;
        continue;
      }
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- see above
      if (await restartImport(row)) {
        result.restarted += 1;
      }
    } catch (error) {
      console.error("analytics_imports.recovery_failed", {
        importId: row.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  return result;
}
