import { bumpAnalyticsVersions } from "@notra/analytics/cache/query-cache";
import { TinybirdDeleteBusyError } from "@notra/analytics/errors/tinybird";
import { purgeImportedRows } from "@notra/analytics/tinybird/purge";
import { ANALYTICS_IMPORT_ACTIVE_STATUSES } from "@notra/db/constants/analytics-imports";
import { db } from "@notra/db/drizzle";
import {
  analyticsImportChunks,
  analyticsImportConnections,
  analyticsImports,
} from "@notra/db/schema";
import {
  IMPORT_CSV_RECORDS_PER_CHUNK,
  IMPORT_CSV_ZIP_SLICE_BYTES,
  IMPORT_PROVIDERS,
} from "@notra/geo-core/constants/analytics-imports";
import { forgetCompletedImportIds } from "@notra/geo-core/geo/analytics-imports";
import { describeImportError } from "@notra/geo-core/imports/http";
import {
  bytesToChunks,
  parsePlausibleCsvZip,
} from "@notra/geo-core/imports/plausible-csv";
import {
  ImportAuthError,
  ImportRateLimitedError,
} from "@notra/geo-core/schemas/analytics-import-errors";
import type { ImportDayRange } from "@notra/geo-core/types/analytics-imports";
import {
  importChunks,
  weightedChunks,
} from "@notra/geo-core/utils/analytics-import-range";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import {
  ANALYTICS_IMPORT_BUDGET_WAIT,
  ANALYTICS_IMPORT_MAX_CHUNK_ATTEMPTS,
  ANALYTICS_IMPORT_MAX_ERROR_LENGTH,
  ANALYTICS_IMPORT_STORAGE_RETRY_SECONDS,
  ANALYTICS_IMPORT_STORAGE_WAIT,
} from "@/constants/analytics-imports";
import type {
  AnalyticsImportChunkOutcome,
  AnalyticsImportPlan,
  AnalyticsImportRow,
  AnalyticsImportWritten,
} from "@/types/analytics-imports";

import { wakeQueuedImport } from "./queue";
import { deleteImportUpload, readImportRowUpload } from "./storage";
import { writeImportWindow } from "./write";

function loadImport(importId: string) {
  return db.query.analyticsImports.findFirst({
    where: eq(analyticsImports.id, importId),
  });
}

function isStopped(row: AnalyticsImportRow | undefined): boolean {
  return !row || row.status === "deleting" || row.status === "deleted";
}

function effectiveRange(row: AnalyticsImportRow): ImportDayRange | null {
  return row.effectiveStartDay && row.effectiveEndDay
    ? { start: row.effectiveStartDay, end: row.effectiveEndDay }
    : null;
}

function chunkWhere(importId: string, chunkStart: string) {
  return and(
    eq(analyticsImportChunks.importId, importId),
    eq(analyticsImportChunks.chunkStart, chunkStart)
  );
}

/** Matches an import still in flight, so a late step never revives a stopped or finished one. */
function activeImportWhere(importId: string) {
  return and(
    eq(analyticsImports.id, importId),
    inArray(analyticsImports.status, [...ANALYTICS_IMPORT_ACTIVE_STATUSES])
  );
}

/** The export an import reads: bytes held in this process, or its upload. */
function csvExport(row: AnalyticsImportRow, csv?: Uint8Array) {
  return csv
    ? bytesToChunks(csv, IMPORT_CSV_ZIP_SLICE_BYTES)
    : readImportRowUpload(row);
}

/**
 * Day ranges newest first. API imports use calendar months, split further
 * where the provider's budget needs it; CSV exports are read once to size
 * chunks by records, since each chunk's step parses the export again and
 * writes only its own days.
 */
async function chunksFor(
  row: AnalyticsImportRow,
  range: ImportDayRange,
  csv?: Uint8Array
): Promise<ImportDayRange[]> {
  if (row.provider !== "plausible_csv") {
    return importChunks(range, IMPORT_PROVIDERS[row.provider].maxChunkDays);
  }
  const summary = await parsePlausibleCsvZip(
    csvExport(row, csv),
    () => undefined
  );
  return weightedChunks(
    range,
    summary.recordsByDay,
    IMPORT_CSV_RECORDS_PER_CHUNK
  );
}

/**
 * Creates chunks newest first on the first run; a resumed run returns the
 * chunks that are not done yet.
 */
export async function planAnalyticsImport(
  importId: string,
  csv?: Uint8Array
): Promise<AnalyticsImportPlan | null> {
  const row = await loadImport(importId);
  if (!row || isStopped(row) || row.status === "completed") {
    return null;
  }
  const range = effectiveRange(row);
  if (!range) {
    return null;
  }
  const existing = await db.query.analyticsImportChunks.findMany({
    where: eq(analyticsImportChunks.importId, importId),
  });
  if (existing.length > 0) {
    const [resumed] = await db
      .update(analyticsImports)
      .set({ status: "running" })
      .where(activeImportWhere(importId))
      .returning({ id: analyticsImports.id });
    if (!resumed) {
      return null;
    }
    return {
      chunks: existing
        .filter((chunk) => chunk.status !== "done")
        .map((chunk) => chunk.chunkStart)
        .toSorted((a, b) => b.localeCompare(a)),
    };
  }
  const chunks = await chunksFor(row, range, csv);
  const planned = await db.transaction(async (tx) => {
    const [started] = await tx
      .update(analyticsImports)
      .set({ chunksTotal: chunks.length, status: "running" })
      .where(activeImportWhere(importId))
      .returning({ id: analyticsImports.id });
    if (!started) {
      return false;
    }
    await tx
      .insert(analyticsImportChunks)
      .values(
        chunks.map((chunk) => ({
          importId,
          chunkStart: chunk.start,
          chunkEnd: chunk.end,
        }))
      )
      .onConflictDoNothing();
    return true;
  });
  return planned ? { chunks: chunks.map((chunk) => chunk.start) } : null;
}

/**
 * Removes what a chunk wrote after its import was deleted mid-request: the
 * delete's purge may already have run, and nothing else would reach them.
 */
async function abandonChunk(
  row: AnalyticsImportRow,
  window: ImportDayRange
): Promise<AnalyticsImportChunkOutcome> {
  await purgeImportedRows({
    organizationId: row.organizationId,
    importId: row.id,
    fromDay: window.start,
    toDay: window.end,
  });
  return { status: "cancelled" };
}

/**
 * Seconds a chunk waits before its retry, or null when it doesn't wait. A
 * Tinybird delete queue that stays full waits too, however often it happens.
 * A 401/403 is never waited out: the provider rejected the token itself.
 */
function retryWaitSeconds(error: unknown, inline: boolean): number | null {
  if (error instanceof ImportRateLimitedError) {
    return error.retryAfterSeconds;
  }
  return error instanceof TinybirdDeleteBusyError && !inline
    ? ANALYTICS_IMPORT_STORAGE_RETRY_SECONDS
    : null;
}

/** What a waiting import shows instead of "the provider asked for a pause". */
function waitReason(error: unknown): string | null {
  if (error instanceof TinybirdDeleteBusyError) {
    return ANALYTICS_IMPORT_STORAGE_WAIT;
  }
  return error instanceof ImportRateLimitedError && error.budget
    ? ANALYTICS_IMPORT_BUDGET_WAIT
    : null;
}

/**
 * Records a chunk that did not finish. Rate limits and transient failures
 * leave it pending for the workflow to retry; anything else fails it.
 */
async function recordChunkFailure(
  row: AnalyticsImportRow,
  chunkStart: string,
  window: ImportDayRange,
  attempts: number,
  error: unknown,
  inline: boolean
): Promise<AnalyticsImportChunkOutcome> {
  if (isStopped(await loadImport(row.id))) {
    return await abandonChunk(row, window);
  }
  const message = describeImportError(error);
  const rateLimited = error instanceof ImportRateLimitedError;
  const storageBusy = error instanceof TinybirdDeleteBusyError;
  const waitSeconds = retryWaitSeconds(error, inline);
  const reauth = error instanceof ImportAuthError && waitSeconds === null;
  const retry =
    !(error instanceof ImportAuthError) &&
    !inline &&
    attempts < ANALYTICS_IMPORT_MAX_CHUNK_ATTEMPTS;
  await db.transaction(async (tx) => {
    await tx
      .update(analyticsImportChunks)
      .set({
        status: waitSeconds !== null || retry ? "pending" : "failed",
        lastError: message,
        // A rate limit or a busy delete queue is not the chunk failing, so
        // it never counts toward the attempts that fail the import.
        ...((rateLimited || storageBusy) && {
          attempts: sql`${analyticsImportChunks.attempts} - 1`,
        }),
      })
      .where(chunkWhere(row.id, chunkStart));
    if (waitSeconds !== null) {
      await tx
        .update(analyticsImports)
        .set({
          status: "waiting_rate_limit",
          retryAt: new Date(Date.now() + waitSeconds * 1000),
          lastError: waitReason(error),
        })
        .where(activeImportWhere(row.id));
    }
    if (reauth && row.connectionId) {
      await tx
        .update(analyticsImportConnections)
        .set({ status: "reauth_required", lastError: message })
        .where(eq(analyticsImportConnections.id, row.connectionId));
    }
  });
  if (waitSeconds !== null) {
    return { status: "rate_limited", retryAfterSeconds: waitSeconds };
  }
  if (retry) {
    throw error;
  }
  return { status: "failed", error: message };
}

function runFenceWhere(generation?: number, runId?: string) {
  if (generation !== undefined) {
    return eq(analyticsImports.recoveryAttempts, generation);
  }
  if (runId !== undefined) {
    return eq(analyticsImports.workflowRunId, runId);
  }
  return undefined;
}

/**
 * Imports one chunk. A retried chunk whose earlier attempt started writing
 * first deletes those days, so re-runs never double count; an attempt that
 * failed before writing (a fetch error, a rate limit) leaves nothing to
 * delete and its retry skips the delete. Rate limits and transient failures
 * leave the chunk pending for the workflow to retry. Every import write is
 * conditional on the import still running, so a delete that lands while a
 * request is in flight is never undone. A run started for an earlier
 * `generation` (recovery has replaced it since) is cancelled before it
 * claims the chunk, so two runs never import at once. A run without a
 * generation passes its `runId` instead and goes on only while it is still
 * the import's current run.
 */
export async function runAnalyticsImportChunk(
  importId: string,
  chunkStart: string,
  {
    csv,
    generation,
    runId,
  }: {
    csv?: AsyncIterable<Uint8Array>;
    generation?: number;
    runId?: string;
  } = {}
): Promise<AnalyticsImportChunkOutcome> {
  const row = await loadImport(importId);
  if (!row || isStopped(row)) {
    return { status: "cancelled" };
  }
  const range = effectiveRange(row);
  if (!range) {
    return { status: "failed", error: "Import has no date range" };
  }
  const [running] = await db
    .update(analyticsImports)
    .set({ status: "running", retryAt: null, lastError: null })
    .where(and(activeImportWhere(importId), runFenceWhere(generation, runId)))
    .returning({ id: analyticsImports.id });
  if (!running) {
    return { status: "cancelled" };
  }
  const [chunk] = await db
    .update(analyticsImportChunks)
    .set({
      status: "running",
      attempts: sql`${analyticsImportChunks.attempts} + 1`,
    })
    .where(
      and(
        chunkWhere(importId, chunkStart),
        ne(analyticsImportChunks.status, "done")
      )
    )
    .returning();
  if (!chunk) {
    return { status: "done" };
  }
  const window = {
    start: chunk.chunkStart < range.start ? range.start : chunk.chunkStart,
    end: chunk.chunkEnd > range.end ? range.end : chunk.chunkEnd,
  };
  let written: AnalyticsImportWritten;
  try {
    if (chunk.writeStartedAt) {
      await purgeImportedRows({
        organizationId: row.organizationId,
        importId,
        fromDay: window.start,
        toDay: window.end,
      });
      // The days are empty again: a retry that fails before writing (a rate
      // limit) has nothing to delete. beforeWrite sets it again.
      await db
        .update(analyticsImportChunks)
        .set({ writeStartedAt: null })
        .where(chunkWhere(importId, chunkStart));
    }
    written = await writeImportWindow(row, window, {
      csv,
      beforeWrite: async () => {
        await db
          .update(analyticsImportChunks)
          .set({ writeStartedAt: new Date() })
          .where(chunkWhere(importId, chunkStart));
      },
    });
  } catch (error) {
    return await recordChunkFailure(
      row,
      chunkStart,
      window,
      chunk.attempts,
      error,
      Boolean(csv)
    );
  }
  const recorded = await db.transaction(async (tx) => {
    const [counted] = await tx
      .update(analyticsImports)
      .set({
        chunksDone: sql`${analyticsImports.chunksDone} + 1`,
        rowsWritten: sql`${analyticsImports.rowsWritten} + ${written.rows}`,
        pageviewsImported: sql`${analyticsImports.pageviewsImported} + ${written.pageviews}`,
        lastError: null,
      })
      .where(activeImportWhere(importId))
      .returning({ id: analyticsImports.id });
    if (!counted) {
      return false;
    }
    await tx
      .update(analyticsImportChunks)
      .set({
        status: "done",
        rowsWritten: written.rows,
        pageviews: written.pageviews,
        lastError: null,
      })
      .where(chunkWhere(importId, chunkStart));
    return true;
  });
  return recorded ? { status: "done" } : await abandonChunk(row, window);
}

async function dropUpload(row: AnalyticsImportRow) {
  if (row.uploadObjectKey) {
    await deleteImportUpload(row.uploadObjectKey).catch(() => undefined);
    await db
      .update(analyticsImports)
      .set({ uploadObjectKey: null })
      .where(eq(analyticsImports.id, row.id));
  }
}

async function refreshReads(organizationId: string) {
  forgetCompletedImportIds(organizationId);
  await bumpAnalyticsVersions("geo", [organizationId]);
}

/** Reveals the import to every analytics read. */
export async function finalizeAnalyticsImport(importId: string) {
  const [row] = await db
    .update(analyticsImports)
    .set({ status: "completed", completedAt: new Date(), retryAt: null })
    .where(activeImportWhere(importId))
    .returning();
  if (row) {
    await dropUpload(row);
    await refreshReads(row.organizationId);
    await wakeQueuedImport(row.connectionId);
  }
}

/**
 * Marks an active import failed, then deletes the rows it wrote. Reads only
 * include completed imports, so those rows were never visible and the delete
 * is cleanup: when Tinybird is busy the import still fails at once and keeps
 * `purgePending` for the recovery job, instead of staying active and being
 * restarted. A chunk that writes after this finds the import stopped and
 * purges its own window.
 */
export async function failAnalyticsImport(importId: string, error: string) {
  const [row] = await db
    .update(analyticsImports)
    .set({
      status: "failed",
      lastError: error.slice(0, ANALYTICS_IMPORT_MAX_ERROR_LENGTH),
      retryAt: null,
      purgePending: true,
    })
    .where(activeImportWhere(importId))
    .returning();
  if (!row) {
    return;
  }
  await dropUpload(row);
  await wakeQueuedImport(row.connectionId);
  await purgeFailedImportRows(row);
}

/**
 * Deletes a failed import's rows and clears `purgePending`. Never throws: a
 * delete that fails stays pending for the next recovery pass.
 */
export async function purgeFailedImportRows(
  row: Pick<AnalyticsImportRow, "id" | "organizationId">
): Promise<boolean> {
  try {
    await purgeImportedRows({
      organizationId: row.organizationId,
      importId: row.id,
    });
  } catch (error) {
    console.error("analytics_imports.purge_deferred", {
      importId: row.id,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
  await db
    .update(analyticsImports)
    .set({ purgePending: false })
    .where(
      and(
        eq(analyticsImports.id, row.id),
        eq(analyticsImports.status, "failed")
      )
    );
  return true;
}

/** Deletes an import's Tinybird rows, then the import itself stays as "deleted". */
export async function deleteAnalyticsImportData(importId: string) {
  const row = await loadImport(importId);
  if (!row || row.status === "deleted") {
    return;
  }
  await purgeImportedRows({ organizationId: row.organizationId, importId });
  await db
    .update(analyticsImports)
    .set({ status: "deleted", deletedAt: new Date(), retryAt: null })
    .where(eq(analyticsImports.id, importId));
  await dropUpload(row);
  await refreshReads(row.organizationId);
  await wakeQueuedImport(row.connectionId);
}

/**
 * Runs a whole import in this process; used for inline uploads when no
 * object storage (and so no durable workflow input) is available.
 */
export async function runAnalyticsImportInline(
  importId: string,
  csv: Uint8Array
): Promise<void> {
  let plan: AnalyticsImportPlan | null;
  try {
    plan = await planAnalyticsImport(importId, csv);
  } catch (error) {
    await failAnalyticsImport(importId, describeImportError(error));
    return;
  }
  if (!plan) {
    return;
  }
  for (const chunkStart of plan.chunks) {
    let outcome: AnalyticsImportChunkOutcome;
    try {
      // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one chunk per export
      outcome = await runAnalyticsImportChunk(importId, chunkStart, {
        csv: bytesToChunks(csv, IMPORT_CSV_ZIP_SLICE_BYTES),
      });
    } catch (error) {
      // Nothing retries an inline import, so an error ends it.
      await failAnalyticsImport(importId, describeImportError(error));
      return;
    }
    if (outcome.status === "cancelled") {
      return;
    }
    if (outcome.status !== "done") {
      await failAnalyticsImport(
        importId,
        outcome.status === "failed" ? outcome.error : "Import was rate limited"
      );
      return;
    }
  }
  await finalizeAnalyticsImport(importId);
}
