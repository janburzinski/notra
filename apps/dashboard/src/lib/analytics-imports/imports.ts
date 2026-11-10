import { queryWebNativeFirstDay } from "@notra/analytics/tinybird/client";
import { ANALYTICS_IMPORT_ACTIVE_STATUSES } from "@notra/db/constants/analytics-imports";
import { db } from "@notra/db/drizzle";
import {
  analyticsImportConnections,
  analyticsImports,
  projects,
} from "@notra/db/schema";
import type { AnalyticsImportProvider } from "@notra/db/types/analytics-imports";
import { isPgUniqueViolation } from "@notra/db/utils/pg-errors";
import { IMPORT_PROVIDERS } from "@notra/geo-core/constants/analytics-imports";
import {
  forgetCompletedImportIds,
  toImportSummary,
} from "@notra/geo-core/geo/analytics-imports";
import { normalizeImportHost } from "@notra/geo-core/imports/map-dimensions";
import type {
  ImportDayRange,
  ImportKind,
} from "@notra/geo-core/types/analytics-imports";
import {
  importHostScope,
  importHostScopesOverlap,
  providerHostScope,
} from "@notra/geo-core/utils/analytics-import-host";
import {
  importCutoffDay,
  monthChunks,
  NATIVE_EPOCH_DAY,
  pageviewsInRange,
  resolveImportRange,
  sharedDays,
  toDay,
} from "@notra/geo-core/utils/analytics-import-range";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { ANALYTICS_IMPORT_ACTIVE_SOURCE_INDEX } from "@/constants/analytics-imports";
import type {
  AnalyticsImportConnectionRow,
  AnalyticsImportConnectionSummary,
  AnalyticsImportCredentials,
  AnalyticsImportPreview,
  AnalyticsImportReader,
  AnalyticsImportRow,
  AnalyticsImportSourcePageviews,
  AnalyticsImportSummary,
  CoveredImport,
  CoveredImportSource,
  CreateAnalyticsImportInput,
  ImportRangeBase,
  ImportRangePlan,
  PlanImportRangeInput,
  SaveAnalyticsImportConnectionInput,
} from "@/types/analytics-imports";

import { encryptImportCredentials } from "./credentials";
import { queuedBehind } from "./queue";

export class AnalyticsImportInputError extends Error {}

export function toConnectionSummary(
  row: AnalyticsImportConnectionRow
): AnalyticsImportConnectionSummary {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    status: row.status,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}

function externalAccountId(credentials: AnalyticsImportCredentials) {
  return credentials.provider === "vercel"
    ? (credentials.teamId ?? null)
    : null;
}

export async function projectBelongsTo(
  organizationId: string,
  projectId: string
): Promise<boolean> {
  const row = await db.query.projects.findFirst({
    columns: { id: true },
    where: and(
      eq(projects.id, projectId),
      eq(projects.organizationId, organizationId)
    ),
  });
  return Boolean(row);
}

/**
 * The first day of native traffic for the host, read live from Tinybird.
 * Without an answer the cut-off is unknown, so nothing is imported rather
 * than risking days Notra already counted. `nativeStartDay` is null only when
 * Notra has no traffic for the host at all, including traffic from today.
 */
async function cutoffFor(
  organizationId: string,
  projectId: string,
  host: string,
  kind: ImportKind
): Promise<Pick<ImportRangeBase, "cutoffDay" | "nativeStartDay">> {
  const today = toDay(new Date());
  const result = await queryWebNativeFirstDay({
    organization_id: organizationId,
    project_id: projectId,
    hosts: importHostScope(host),
  });
  if (!result) {
    throw new AnalyticsImportInputError(
      "Analytics storage isn't available, so imports can't start right now"
    );
  }
  const row = result.data[0];
  const firstDay = kind === "web" ? row?.web_first_day : row?.geo_first_day;
  const cutoffDay = importCutoffDay([firstDay], today);
  return {
    cutoffDay,
    nativeStartDay:
      firstDay && firstDay !== NATIVE_EPOCH_DAY ? cutoffDay : null,
  };
}

async function rangeBase(
  input: PlanImportRangeInput
): Promise<ImportRangeBase> {
  const host = normalizeImportHost(input.host);
  if (!host) {
    throw new AnalyticsImportInputError("Enter a valid domain");
  }
  const { kind } = IMPORT_PROVIDERS[input.provider];
  return {
    host,
    kind,
    ...(await cutoffFor(input.organizationId, input.projectId, host, kind)),
  };
}

/**
 * Days imports already wrote that this one could repeat: every import of the
 * same source, whatever its domain, and other sources' imports for any host
 * this one can write (its host and www alias, plus subdomains for providers
 * that report hostnames).
 */
async function coveredImports(
  executor: AnalyticsImportReader,
  projectId: string,
  source: CoveredImportSource,
  kind: ImportKind
): Promise<CoveredImport[]> {
  const scope = providerHostScope(source.provider, source.host);
  const rows = await executor.query.analyticsImports.findMany({
    columns: {
      id: true,
      provider: true,
      externalSiteRef: true,
      externalSiteLabel: true,
      host: true,
      effectiveStartDay: true,
      effectiveEndDay: true,
    },
    where: and(
      eq(analyticsImports.projectId, projectId),
      eq(analyticsImports.kind, kind),
      inArray(analyticsImports.status, [
        "completed",
        ...ANALYTICS_IMPORT_ACTIVE_STATUSES,
      ])
    ),
    orderBy: [desc(analyticsImports.effectiveEndDay)],
  });
  return rows.flatMap((row) =>
    row.effectiveStartDay &&
    row.effectiveEndDay &&
    ((row.provider === source.provider &&
      row.externalSiteRef === source.sourceRef) ||
      importHostScopesOverlap(providerHostScope(row.provider, row.host), scope))
      ? [
          {
            id: row.id,
            provider: row.provider,
            sourceRef: row.externalSiteRef,
            sourceLabel: row.externalSiteLabel ?? row.externalSiteRef,
            host: row.host,
            start: row.effectiveStartDay,
            end: row.effectiveEndDay,
          },
        ]
      : []
  );
}

function sameRange(a: ImportDayRange | null, b: ImportDayRange | null) {
  return a?.start === b?.start && a?.end === b?.end;
}

/**
 * Days the same source already has are always left out. Days another
 * source has for the same domain are left out by default ("skip": the same
 * site tracked twice) or kept ("add": two sites merged, both counts sum).
 */
function resolvePlan(
  input: PlanImportRangeInput,
  base: ImportRangeBase,
  covered: readonly CoveredImport[]
): ImportRangePlan {
  const rangeInput = {
    requestedStart: input.requestedStart,
    requestedEnd: input.requestedEnd,
    earliestDay: input.earliestDay,
    cutoffDay: base.cutoffDay,
  };
  const ownSource = (item: CoveredImport) =>
    item.provider === input.provider && item.sourceRef === input.sourceRef;
  const unclipped = resolveImportRange({ ...rangeInput, covered: [] });
  const own = covered.filter(ownSource);
  const added = resolveImportRange({ ...rangeInput, covered: own });
  const skipped = resolveImportRange({ ...rangeInput, covered });
  const overlaps = added
    ? sharedDays(
        added,
        covered.filter((item) => !ownSource(item))
      ).map((item) => ({
        importId: item.id,
        provider: item.provider,
        sourceLabel: item.sourceLabel,
        host: item.host,
        startDay: item.start,
        endDay: item.end,
      }))
    : [];
  const range = input.overlap === "add" ? added : skipped;
  return {
    ...base,
    range,
    clipped: !sameRange(unclipped, range),
    skipped,
    added,
    unclipped,
    overlaps,
    alreadyImported: Boolean(unclipped && sharedDays(unclipped, own).length),
  };
}

/**
 * Cut-off and overlap rules shared by the preview and the create call:
 * imports end the day before native data starts, never repeat days their
 * own source already has, and skip or add days other sources have.
 */
export async function planImportRange(
  input: PlanImportRangeInput
): Promise<ImportRangePlan> {
  const base = await rangeBase(input);
  const covered = await coveredImports(
    db,
    input.projectId,
    { provider: input.provider, sourceRef: input.sourceRef, host: base.host },
    base.kind
  );
  return resolvePlan(input, base, covered);
}

/**
 * The preview of both choices: page views count only the days each range
 * takes, from per-day or per-month counts when the source has them.
 */
export function toPreview(
  provider: AnalyticsImportProvider,
  plan: ImportRangePlan,
  pageviews: AnalyticsImportSourcePageviews
): AnalyticsImportPreview {
  const pageviewsIn = (range: ImportDayRange | null) => {
    if (!range) {
      return 0;
    }
    return pageviews.counts
      ? pageviewsInRange(pageviews.counts, range, toDay(new Date()))
      : pageviews.total;
  };
  return {
    provider,
    kind: plan.kind,
    cutoffDay: plan.cutoffDay,
    nativeStartDay: plan.nativeStartDay,
    startDay: plan.skipped?.start ?? null,
    endDay: plan.skipped?.end ?? null,
    months: plan.skipped ? monthChunks(plan.skipped).length : 0,
    pageviews: pageviewsIn(plan.skipped),
    clipped: !sameRange(plan.unclipped, plan.skipped),
    overlaps: plan.overlaps,
    alreadyImported: plan.alreadyImported,
    added:
      plan.overlaps.length > 0
        ? {
            startDay: plan.added?.start ?? null,
            endDay: plan.added?.end ?? null,
            months: plan.added ? monthChunks(plan.added).length : 0,
            pageviews: pageviewsIn(plan.added),
            clipped: !sameRange(plan.unclipped, plan.added),
          }
        : null,
  };
}

/**
 * Plans and inserts in one transaction holding a per-project lock, so two
 * imports started at once can't both claim the same days.
 */
export async function createAnalyticsImport(
  input: CreateAnalyticsImportInput
): Promise<AnalyticsImportRow> {
  const base = await rangeBase(input);
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`analytics-import:${input.projectId}`}))`
      );
      const covered = await coveredImports(
        tx,
        input.projectId,
        {
          provider: input.provider,
          sourceRef: input.sourceRef,
          host: base.host,
        },
        base.kind
      );
      const plan = resolvePlan(input, base, covered);
      if (!plan.range) {
        throw new AnalyticsImportInputError(
          "Nothing to import: Notra already has data for this period or another import covers it"
        );
      }
      const [row] = await tx
        .insert(analyticsImports)
        .values({
          id: `imp_${nanoid(16)}`,
          organizationId: input.organizationId,
          projectId: input.projectId,
          connectionId: input.connectionId,
          provider: input.provider,
          kind: plan.kind,
          externalSiteRef: input.sourceRef,
          externalSiteLabel: input.sourceLabel,
          host: plan.host,
          requestedStartDay: input.requestedStart,
          requestedEndDay: input.requestedEnd,
          cutoffDay: plan.cutoffDay,
          effectiveStartDay: plan.range.start,
          effectiveEndDay: plan.range.end,
          capabilities: IMPORT_PROVIDERS[input.provider].capabilities,
          uploadObjectKey: input.uploadKey ?? null,
          createdByUserId: input.userId,
        })
        .returning();
      if (!row) {
        throw new Error("Import was not created");
      }
      return row;
    });
  } catch (error) {
    if (isPgUniqueViolation(error, ANALYTICS_IMPORT_ACTIVE_SOURCE_INDEX)) {
      throw new AnalyticsImportInputError(
        "This site is already being imported. Start it again once that import has finished."
      );
    }
    throw error;
  }
}

export async function setImportWorkflowRun(importId: string, runId: string) {
  await db
    .update(analyticsImports)
    .set({ workflowRunId: runId })
    .where(eq(analyticsImports.id, importId));
}

/** The import that owns an uploaded export, unless it was deleted. */
export async function findImportByUploadKey(
  organizationId: string,
  uploadKey: string
): Promise<AnalyticsImportRow | null> {
  const row = await db.query.analyticsImports.findFirst({
    where: and(
      eq(analyticsImports.organizationId, organizationId),
      eq(analyticsImports.uploadObjectKey, uploadKey),
      ne(analyticsImports.status, "deleted")
    ),
  });
  return row ?? null;
}

export async function listAnalyticsImports(
  organizationId: string,
  projectId: string | null
): Promise<AnalyticsImportSummary[]> {
  const rows = await db.query.analyticsImports.findMany({
    where: and(
      eq(analyticsImports.organizationId, organizationId),
      ne(analyticsImports.status, "deleted"),
      projectId ? eq(analyticsImports.projectId, projectId) : undefined
    ),
    orderBy: [desc(analyticsImports.createdAt)],
  });
  const waiting = await queuedBehind(rows);
  return rows.map((row) => toImportSummary(row, waiting.get(row.id) ?? null));
}

/** An import's public shape, with the import it waits for when queued. */
export async function summarizeImport(
  row: AnalyticsImportRow
): Promise<AnalyticsImportSummary> {
  const waiting = await queuedBehind([row]);
  return toImportSummary(row, waiting.get(row.id) ?? null);
}

/** Hides the import from reads at once; Tinybird rows are deleted afterwards. */
export async function markImportDeleting(
  organizationId: string,
  importId: string
): Promise<AnalyticsImportRow | null> {
  const [row] = await db
    .update(analyticsImports)
    .set({ status: "deleting" })
    .where(
      and(
        eq(analyticsImports.id, importId),
        eq(analyticsImports.organizationId, organizationId),
        ne(analyticsImports.status, "deleted")
      )
    )
    .returning();
  if (row) {
    forgetCompletedImportIds(organizationId);
  }
  return row ?? null;
}

export async function listConnections(
  organizationId: string
): Promise<AnalyticsImportConnectionSummary[]> {
  const rows = await db.query.analyticsImportConnections.findMany({
    where: eq(analyticsImportConnections.organizationId, organizationId),
    orderBy: [desc(analyticsImportConnections.createdAt)],
  });
  return rows.map(toConnectionSummary);
}

export async function findConnection(
  organizationId: string,
  connectionId: string
): Promise<AnalyticsImportConnectionRow | null> {
  const row = await db.query.analyticsImportConnections.findFirst({
    where: and(
      eq(analyticsImportConnections.id, connectionId),
      eq(analyticsImportConnections.organizationId, organizationId)
    ),
  });
  return row ?? null;
}

export async function saveConnection(
  input: SaveAnalyticsImportConnectionInput
): Promise<AnalyticsImportConnectionRow> {
  const [row] = await db
    .insert(analyticsImportConnections)
    .values({
      id: `aic_${nanoid(16)}`,
      organizationId: input.organizationId,
      provider: input.credentials.provider,
      label: input.label,
      externalAccountId: externalAccountId(input.credentials),
      encryptedCredentials: encryptImportCredentials(input.credentials),
      createdByUserId: input.userId,
    })
    .returning();
  if (!row) {
    throw new Error("Connection was not saved");
  }
  return row;
}

/**
 * Swaps a connection's credentials for new, already validated ones and
 * clears its reauth state, so imports keep their link to it. Null when the
 * connection is not the organization's or is for another provider.
 */
export async function replaceConnectionCredentials(
  organizationId: string,
  connectionId: string,
  credentials: AnalyticsImportCredentials
): Promise<AnalyticsImportConnectionRow | null> {
  const [row] = await db
    .update(analyticsImportConnections)
    .set({
      encryptedCredentials: encryptImportCredentials(credentials),
      externalAccountId: externalAccountId(credentials),
      status: "active",
      lastError: null,
    })
    .where(
      and(
        eq(analyticsImportConnections.id, connectionId),
        eq(analyticsImportConnections.organizationId, organizationId),
        eq(analyticsImportConnections.provider, credentials.provider)
      )
    )
    .returning();
  return row ?? null;
}

export async function markConnectionReauth(
  connectionId: string,
  error: string
) {
  await db
    .update(analyticsImportConnections)
    .set({ status: "reauth_required", lastError: error })
    .where(eq(analyticsImportConnections.id, connectionId));
}

/**
 * Deletes the stored credentials. Imported data stays unless the caller also
 * deletes the imports; their rows lose the link to the connection.
 */
export async function deleteConnection(
  organizationId: string,
  connectionId: string
): Promise<AnalyticsImportRow[]> {
  const imports = await db.query.analyticsImports.findMany({
    where: and(
      eq(analyticsImports.connectionId, connectionId),
      eq(analyticsImports.organizationId, organizationId),
      ne(analyticsImports.status, "deleted")
    ),
  });
  await db
    .delete(analyticsImportConnections)
    .where(
      and(
        eq(analyticsImportConnections.id, connectionId),
        eq(analyticsImportConnections.organizationId, organizationId)
      )
    );
  return imports;
}
