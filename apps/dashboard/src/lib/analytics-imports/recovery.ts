import { ANALYTICS_IMPORT_ACTIVE_STATUSES } from "@notra/db/constants/analytics-imports";
import { db } from "@notra/db/drizzle";
import { analyticsImports } from "@notra/db/schema";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";

import {
  ANALYTICS_IMPORT_LOST_ERROR,
  ANALYTICS_IMPORT_LOST_UPLOAD_ERROR,
  ANALYTICS_IMPORT_LOST_WAIT_MS,
  ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS,
  ANALYTICS_IMPORT_RECOVERY_BATCH,
  ANALYTICS_IMPORT_STALE_MS,
} from "@/constants/analytics-imports";
import {
  startAnalyticsImportDeleteRun,
  startAnalyticsImportRun,
} from "@/lib/workflows/start";
import type {
  AnalyticsImportRecoveryResult,
  AnalyticsImportRow,
} from "@/types/analytics-imports";

import { setImportWorkflowRun } from "./imports";
import { failAnalyticsImport } from "./runner";
import { cancelImportRun, readImportRunState } from "./runs";

/** A run that ended or vanished while its import still reads as active. */
async function isRunLost(runId: string): Promise<boolean> {
  const state = await readImportRunState(runId);
  return state !== "pending" && state !== "running";
}

/** A rate-limit wait whose sleep never woke its run, which still reads as running. */
function isWaitLost(row: AnalyticsImportRow, lostBefore: Date): boolean {
  return (
    row.status === "waiting_rate_limit" &&
    row.retryAt !== null &&
    row.retryAt < lostBefore
  );
}

/**
 * Starts a new run for a lost import; planning resumes at its first
 * unfinished chunk. The attempt is counted before the start, so an import
 * whose runs keep getting lost fails instead of restarting forever. The new
 * run carries the new count as its generation, so the old one stops before
 * its next chunk. A lost wait is claimed only while it still waits past the
 * cut-off: once the old run's chunk has started, that run is alive.
 */
async function restartImport(
  row: AnalyticsImportRow,
  lostWaitBefore: Date | null
): Promise<boolean> {
  const [claimed] = await db
    .update(analyticsImports)
    .set({
      recoveryAttempts: sql`${analyticsImports.recoveryAttempts} + 1`,
      // Read as queued from here on; without a run id, a start that fails
      // leaves it lost for the next sweep rather than waiting forever.
      ...(lostWaitBefore
        ? ({
            status: "pending",
            retryAt: null,
            lastError: null,
            workflowRunId: null,
          } as const)
        : {}),
    })
    .where(
      and(
        eq(analyticsImports.id, row.id),
        eq(analyticsImports.recoveryAttempts, row.recoveryAttempts),
        lostWaitBefore
          ? and(
              eq(analyticsImports.status, "waiting_rate_limit"),
              lt(analyticsImports.retryAt, lostWaitBefore)
            )
          : inArray(analyticsImports.status, [
              ...ANALYTICS_IMPORT_ACTIVE_STATUSES,
            ])
      )
    )
    .returning({ id: analyticsImports.id });
  if (!claimed) {
    return false;
  }
  if (lostWaitBefore && row.workflowRunId) {
    await cancelImportRun(row.workflowRunId).catch((error: unknown) => {
      console.error("analytics_imports.cancel_lost_run_failed", {
        importId: row.id,
        error: error instanceof Error ? error.message : error,
      });
    });
  }
  const run = await startAnalyticsImportRun({
    importId: row.id,
    generation: row.recoveryAttempts + 1,
  });
  await setImportWorkflowRun(row.id, run.runId);
  return true;
}

/**
 * Takes an overdue wait away from its old run before failing it: bumping the
 * attempts and clearing the run id fence that run's next chunk, whether it
 * carries a generation or not, and the update only matches while
 * the import still waits past the cut-off. If the old run resumed in the
 * meantime, the import is alive and is left alone.
 */
async function claimLostWait(
  row: AnalyticsImportRow,
  lostWaitBefore: Date
): Promise<boolean> {
  const [claimed] = await db
    .update(analyticsImports)
    .set({
      recoveryAttempts: sql`${analyticsImports.recoveryAttempts} + 1`,
      workflowRunId: null,
    })
    .where(
      and(
        eq(analyticsImports.id, row.id),
        eq(analyticsImports.recoveryAttempts, row.recoveryAttempts),
        eq(analyticsImports.status, "waiting_rate_limit"),
        lt(analyticsImports.retryAt, lostWaitBefore)
      )
    )
    .returning({ id: analyticsImports.id });
  if (claimed && row.workflowRunId) {
    await cancelImportRun(row.workflowRunId).catch((error: unknown) => {
      console.error("analytics_imports.cancel_lost_run_failed", {
        importId: row.id,
        error: error instanceof Error ? error.message : error,
      });
    });
  }
  return claimed !== undefined;
}

/**
 * A delete whose run was lost leaves the import hidden but its rows stored.
 * Deleting is idempotent, so a stale delete starts again. Touching the row
 * claims it: only the sweep whose update still sees it stale starts a run,
 * and the next sweep waits a whole stale window before retrying.
 */
async function retryStaleDeletes(now: number): Promise<number> {
  const staleBefore = new Date(now - ANALYTICS_IMPORT_STALE_MS);
  const rows = await db.query.analyticsImports.findMany({
    columns: { id: true },
    where: and(
      eq(analyticsImports.status, "deleting"),
      lt(analyticsImports.updatedAt, staleBefore)
    ),
    orderBy: [asc(analyticsImports.updatedAt)],
    limit: ANALYTICS_IMPORT_RECOVERY_BATCH,
  });
  let retried = 0;
  for (const row of rows) {
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one import at a time keeps the sweep's load small
      const [claimed] = await db
        .update(analyticsImports)
        .set({ updatedAt: new Date(now) })
        .where(
          and(
            eq(analyticsImports.id, row.id),
            eq(analyticsImports.status, "deleting"),
            lt(analyticsImports.updatedAt, staleBefore)
          )
        )
        .returning({ id: analyticsImports.id });
      if (!claimed) {
        continue;
      }
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- see above
      await startAnalyticsImportDeleteRun({ importId: row.id });
      retried += 1;
    } catch (error) {
      console.error("analytics_imports.delete_recovery_failed", {
        importId: row.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  return retried;
}

/**
 * Finds active imports nobody has touched for a while and checks their
 * workflow run. A run that is still pending or running (also while it
 * sleeps through a rate limit or waits in its account's queue) is left
 * alone, unless its rate-limit wait ended long ago without it waking. A
 * lost run is restarted a few times, then the import fails with a message,
 * which frees its days and its account's queue. An export held in memory
 * (no object storage) can't be read again, so that import fails. Stale
 * deletes start again and count as restarted.
 */
export async function recoverAnalyticsImports(
  now = Date.now()
): Promise<AnalyticsImportRecoveryResult> {
  const staleBefore = new Date(now - ANALYTICS_IMPORT_STALE_MS);
  const lostWaitBefore = new Date(now - ANALYTICS_IMPORT_LOST_WAIT_MS);
  const rows = await db.query.analyticsImports.findMany({
    where: and(
      inArray(analyticsImports.status, [...ANALYTICS_IMPORT_ACTIVE_STATUSES]),
      lt(analyticsImports.updatedAt, staleBefore)
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
      const waitLost = isWaitLost(row, lostWaitBefore);
      if (
        !waitLost &&
        row.workflowRunId &&
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one import at a time keeps the sweep's load small
        !(await isRunLost(row.workflowRunId))
      ) {
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
        if (
          waitLost &&
          // react-doctor-disable-next-line react-doctor/async-await-in-loop -- see above
          !(await claimLostWait(row, lostWaitBefore))
        ) {
          continue;
        }
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
      if (await restartImport(row, waitLost ? lostWaitBefore : null)) {
        result.restarted += 1;
      }
    } catch (error) {
      console.error("analytics_imports.recovery_failed", {
        importId: row.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  result.restarted += await retryStaleDeletes(now);
  return result;
}
