import {
  ingestGeoImportedDaily,
  ingestWebImportedDaily,
} from "@notra/analytics/tinybird/client";
import { toClickHouseDateTime } from "@notra/analytics/utils/datetime";
import { db } from "@notra/db/drizzle";
import { analyticsImportConnections } from "@notra/db/schema";
import { IMPORT_BATCH_ROWS } from "@notra/geo-core/constants/analytics-imports";
import { parsePlausibleCsvZip } from "@notra/geo-core/imports/plausible-csv";
import {
  aggregateGeoRows,
  aggregateWebRows,
  batches,
  inImportRange,
  toGeoImportedRow,
  toWebImportedRow,
} from "@notra/geo-core/imports/rows";
import { ImportAuthError } from "@notra/geo-core/schemas/analytics-import-errors";
import type {
  GeoImportRecord,
  ImportDayRange,
  ImportRowContext,
  WebImportRecord,
} from "@notra/geo-core/types/analytics-imports";
import { importHostScope } from "@notra/geo-core/utils/analytics-import-host";
import { eq } from "drizzle-orm";

import type {
  AnalyticsImportRow,
  AnalyticsImportWritten,
} from "@/types/analytics-imports";

import { decryptImportCredentials } from "./credentials";
import { fetchImportChunk } from "./providers";
import { readImportRowUpload } from "./storage";

function rowContext(row: AnalyticsImportRow): ImportRowContext {
  return {
    organizationId: row.organizationId,
    projectId: row.projectId,
    siteId: row.siteId ?? "",
    importId: row.id,
    provider: row.provider,
    host: row.host,
    importedAt: toClickHouseDateTime(new Date()),
    allowedHosts: [importHostScope(row.host)],
  };
}

async function writeWebRecords(
  row: AnalyticsImportRow,
  records: readonly WebImportRecord[],
  window: ImportDayRange
): Promise<AnalyticsImportWritten> {
  const context = rowContext(row);
  const rows = aggregateWebRows(
    records
      .filter((record) => inImportRange(record.day, window.start, window.end))
      .map((record) => toWebImportedRow(record, context))
  );
  for (const batch of batches(rows, IMPORT_BATCH_ROWS)) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Tinybird batches are written one after another
    await ingestWebImportedDaily(batch);
  }
  const pageviews = rows
    .filter((item) => item.grain === "total")
    .reduce((sum, item) => sum + item.pageviews, 0);
  return { rows: rows.length, pageviews };
}

async function writeGeoRecords(
  row: AnalyticsImportRow,
  records: readonly GeoImportRecord[],
  window: ImportDayRange
): Promise<AnalyticsImportWritten> {
  const context = rowContext(row);
  const rows = aggregateGeoRows(
    records.flatMap((record) =>
      inImportRange(record.day, window.start, window.end)
        ? (toGeoImportedRow(record, context) ?? [])
        : []
    )
  );
  for (const batch of batches(rows, IMPORT_BATCH_ROWS)) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- Tinybird batches are written one after another
    await ingestGeoImportedDaily(batch);
  }
  return {
    rows: rows.length,
    pageviews: rows.reduce((sum, item) => sum + item.requests, 0),
  };
}

async function writeCsvExport(
  row: AnalyticsImportRow,
  window: ImportDayRange,
  csv: AsyncIterable<Uint8Array> | undefined,
  beforeWrite: () => Promise<void>
): Promise<AnalyticsImportWritten> {
  const source = csv ?? readImportRowUpload(row);
  const totals = { rows: 0, pageviews: 0 };
  let writing = false;
  await parsePlausibleCsvZip(source, async (records) => {
    if (!writing) {
      writing = true;
      await beforeWrite();
    }
    const written = await writeWebRecords(row, records, window);
    totals.rows += written.rows;
    totals.pageviews += written.pageviews;
  });
  return totals;
}

/**
 * Reads one window of history from the import's source (the uploaded export
 * or the provider API) and writes it to Tinybird. `beforeWrite` runs once,
 * right before the first row is written; a failure before it left nothing.
 */
export async function writeImportWindow(
  row: AnalyticsImportRow,
  window: ImportDayRange,
  {
    csv,
    beforeWrite,
  }: {
    csv?: AsyncIterable<Uint8Array>;
    beforeWrite: () => Promise<void>;
  }
): Promise<AnalyticsImportWritten> {
  if (row.provider === "plausible_csv") {
    return await writeCsvExport(row, window, csv, beforeWrite);
  }
  const connection = row.connectionId
    ? await db.query.analyticsImportConnections.findFirst({
        where: eq(analyticsImportConnections.id, row.connectionId),
      })
    : undefined;
  if (!connection) {
    throw new ImportAuthError({ provider: row.provider });
  }
  const fetched = await fetchImportChunk({
    credentials: decryptImportCredentials(connection.encryptedCredentials),
    connectionId: connection.id,
    provider: row.provider,
    ref: row.externalSiteRef,
    host: row.host,
    range: window,
  });
  await beforeWrite();
  return fetched.kind === "geo"
    ? await writeGeoRecords(row, fetched.records, window)
    : await writeWebRecords(row, fetched.records, window);
}
