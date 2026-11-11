import { db } from "@notra/db/drizzle";
import { analyticsImports } from "@notra/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { Cache, Effect, Exit } from "effect";

import {
  IMPORT_COMPLETED_IDS_CACHE_MAX_ENTRIES,
  IMPORT_COMPLETED_IDS_CACHE_MS,
} from "../constants/analytics-imports";
import type { AnalyticsImportSummary } from "../types/analytics-import-summary";
import type {
  CompletedImportRow,
  CompletedImports,
  ImportKind,
} from "../types/analytics-imports";
import { CompletedImportsCacheKey } from "../types/ingest-cache-keys";
import {
  importHostScopesOverlap,
  providerHostScope,
} from "../utils/analytics-import-host";
import { toDay } from "../utils/analytics-import-range";
import { logGeoFailure } from "../utils/geo-log";
import { geoDb } from "./effect";

/**
 * Completed imports. An import made before any native traffic gets the day
 * it was created as its cut-off; that is not when Notra started tracking,
 * so its native start is unknown.
 */
const queryCompletedImports = Effect.fnUntraced(function* ({
  organizationId,
  projectId,
  kind,
}: CompletedImportsCacheKey) {
  const rows = yield* Effect.tryPromise(() =>
    db
      .select({
        id: analyticsImports.id,
        provider: analyticsImports.provider,
        host: analyticsImports.host,
        until: analyticsImports.effectiveEndDay,
        cutoffDay: analyticsImports.cutoffDay,
        createdAt: analyticsImports.createdAt,
      })
      .from(analyticsImports)
      .where(
        and(
          eq(analyticsImports.organizationId, organizationId),
          eq(analyticsImports.kind, kind),
          eq(analyticsImports.status, "completed"),
          projectId ? eq(analyticsImports.projectId, projectId) : undefined
        )
      )
  );
  return rows.map(({ cutoffDay, createdAt, ...row }): CompletedImportRow => ({
    ...row,
    nativeStart: cutoffDay && cutoffDay !== toDay(createdAt) ? cutoffDay : null,
  }));
});

// Cached briefly per instance, and only when the lookup succeeded.
const completedImports = Effect.runSync(
  Cache.makeWith(queryCompletedImports, {
    capacity: IMPORT_COMPLETED_IDS_CACHE_MAX_ENTRIES,
    timeToLive: (exit) =>
      Exit.isSuccess(exit) ? IMPORT_COMPLETED_IDS_CACHE_MS : 0,
  })
);

/**
 * Every completed import's id, plus the coverage of the latest one that can
 * write the hosts being read, so the chart marks that import's hand-over day.
 */
function toCompletedImports(
  rows: readonly CompletedImportRow[],
  hosts: readonly string[]
): CompletedImports {
  let coverage: CompletedImports["coverage"] = null;
  for (const row of rows) {
    const relevant =
      hosts.length === 0 ||
      // A host filter also reads its subdomains (GEO_HOSTS_SQL).
      hosts.some((host) =>
        importHostScopesOverlap(providerHostScope(row.provider, row.host), {
          host,
          subdomains: true,
        })
      );
    if (relevant && row.until && (!coverage || row.until > coverage.until)) {
      coverage = {
        provider: row.provider,
        until: row.until,
        nativeStart: row.nativeStart,
      };
    }
  }
  return {
    ids: rows
      .map((row) => row.id)
      .toSorted()
      .join(","),
    coverage,
  };
}

/** Forget cached ids so an import shows up (or disappears) on the next read. */
export function forgetCompletedImportIds(organizationId: string): void {
  Effect.runSync(
    Effect.gen(function* () {
      for (const key of yield* Cache.keys(completedImports)) {
        if (key.organizationId === organizationId) {
          yield* Cache.invalidate(completedImports, key);
        }
      }
    })
  );
}

const NO_IMPORTS: CompletedImports = { ids: "", coverage: null };

/**
 * Completed imports for the analytics `imports` param, plus the latest one's
 * provider and last day for the chart marker. Cached briefly per instance;
 * endpoints still scope rows by project, site and host, so an
 * organization-wide list is safe. A failed lookup reads as "no imports"
 * rather than failing the dashboard.
 */
export const loadCompletedImports = Effect.fn("analytics.completedImports")(
  function* (
    organizationId: string,
    projectId: string | null,
    kind: ImportKind,
    hosts: readonly string[] = []
  ) {
    return yield* Cache.get(
      completedImports,
      new CompletedImportsCacheKey({ organizationId, projectId, kind })
    ).pipe(
      Effect.map((rows) => toCompletedImports(rows, hosts)),
      Effect.catch((error) => {
        logGeoFailure(
          "geo.query.failed",
          "completed imports lookup failed",
          error
        );
        return Effect.succeed(NO_IMPORTS);
      })
    );
  }
);

/** Public shape of an import: progress only, never its connection or key. */
export function toImportSummary(
  row: typeof analyticsImports.$inferSelect,
  waitingFor: string | null = null
): AnalyticsImportSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    provider: row.provider,
    kind: row.kind,
    sourceLabel: row.externalSiteLabel ?? row.externalSiteRef,
    host: row.host,
    status: row.status,
    startDay: row.effectiveStartDay,
    endDay: row.effectiveEndDay,
    cutoffDay: row.cutoffDay,
    chunksTotal: row.chunksTotal,
    chunksDone: row.chunksDone,
    pageviewsImported: row.pageviewsImported,
    rowsWritten: row.rowsWritten,
    capabilities: row.capabilities,
    lastError: row.lastError,
    retryAt: row.retryAt?.toISOString() ?? null,
    waitingFor,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/** A project's imports that were not deleted, newest first. */
export const listAnalyticsImportSummaries = Effect.fn("analytics.importList")(
  function* (organizationId: string, projectId: string) {
    const rows = yield* geoDb("analytics import list failed", () =>
      db.query.analyticsImports.findMany({
        where: and(
          eq(analyticsImports.organizationId, organizationId),
          eq(analyticsImports.projectId, projectId),
          ne(analyticsImports.status, "deleted")
        ),
        orderBy: [desc(analyticsImports.createdAt)],
      })
    );
    return rows.map((row) => toImportSummary(row));
  }
);

/** Comma-separated ids of completed imports for the analytics `imports` param. */
export const loadCompletedImportIds = (
  organizationId: string,
  projectId: string | null,
  kind: ImportKind
) =>
  loadCompletedImports(organizationId, projectId, kind).pipe(
    Effect.map((imports) => imports.ids)
  );
