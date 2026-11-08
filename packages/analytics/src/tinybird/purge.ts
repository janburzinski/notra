import { isDemoMode } from "@notra/utils/demo-mode";
import { Duration, Effect, Schedule } from "effect";

import {
  bumpAnalyticsVersions,
  advancePurgeGeneration,
} from "../cache/query-cache";
import type {
  PurgeGeoProjectInput,
  PurgeImportedRowsInput,
  PurgeOrganizationInput,
  PurgeSiteInput,
  PurgeSocialAccountInput,
} from "../types/purge";

const ACCOUNT_SCOPED_DATASOURCES = [
  "social_accounts",
  "social_account_stats",
  "social_posts",
  "social_post_stats",
  "social_post_stats_latest",
  "social_account_stats_latest",
  "social_post_sources",
];
// Rollups are MV targets: deleting from geo_traffic_events does not reach them.
const GEO_DATASOURCES = [
  "geo_traffic_events",
  "geo_traffic_daily",
  "geo_traffic_pages_by_host_daily",
  "geo_imported_daily",
];
const WEB_DATASOURCES = [
  "web_page_views",
  "web_page_engagement",
  "web_events",
  "web_errors",
  "web_pages_daily",
  "web_sources_daily",
  "web_audience_daily",
];
const MCP_DATASOURCES = ["mcp_events", "mcp_daily"];
// History imports are per project and never site scoped.
const IMPORTED_DATASOURCES = ["web_imported_daily", "geo_imported_daily"];

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_POLL_MAX_ATTEMPTS = 60;
const TINYBIRD_READ_TIMEOUT_MS = 10_000;
const TINYBIRD_MUTATION_TIMEOUT_MS = 30_000;

const ID_PATTERN = /^[\w-]+$/;
// Account ids come from the platforms (numbers, URNs, DIDs such as did:plc:…).
const EXTERNAL_ID_PATTERN = /^[\w.:@+=/-]+$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A value as a quoted literal for a delete condition. Only values that match
 * their allowlist are used; anything else refuses the purge rather than
 * altering a value and deleting a different set of rows.
 */
function literal(value: string, pattern: RegExp, field: string): string {
  if (!pattern.test(value)) {
    throw new Error(`Refusing a Tinybird delete with an invalid ${field}`);
  }
  return `'${value}'`;
}

const id = (value: string, field: string) => literal(value, ID_PATTERN, field);

/** Every datasource once, however many groups list it. */
const unique = (...groups: string[][]) => [...new Set(groups.flat())];

function tinybirdBaseUrl(): string {
  return (
    process.env.TINYBIRD_BASE_URL ??
    process.env.TINYBIRD_URL ??
    "https://api.tinybird.co"
  );
}

function isRetryableJobPollError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "TimeoutError") ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

type TinybirdJobPoll = "done" | "pending";

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * One job status read. Timed-out or aborted reads count as "still pending" so
 * a slow poll costs an attempt instead of failing the purge.
 */
function pollJob(jobId: string): Effect.Effect<TinybirdJobPoll, Error> {
  return Effect.tryPromise({
    try: async (signal): Promise<TinybirdJobPoll> => {
      const response = await fetch(`${tinybirdBaseUrl()}/v0/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${process.env.TINYBIRD_TOKEN}` },
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(TINYBIRD_READ_TIMEOUT_MS),
        ]),
      });
      if (!response.ok) {
        throw new Error(`Tinybird job poll failed (${response.status})`);
      }
      const job: { status?: string; error?: string } = await response.json();
      if (job.status === "error") {
        throw new Error(
          `Tinybird delete job failed: ${job.error ?? "unknown"}`
        );
      }
      return job.status === "done" ? "done" : "pending";
    },
    catch: (cause) => cause,
  }).pipe(
    Effect.catchIf(isRetryableJobPollError, () =>
      Effect.succeed<TinybirdJobPoll>("pending")
    ),
    Effect.mapError(toError)
  );
}

/** Polls the job every second, up to {@link JOB_POLL_MAX_ATTEMPTS} reads. */
function waitForJob(jobId: string): Effect.Effect<void, Error> {
  return pollJob(jobId).pipe(
    Effect.repeat({
      schedule: Schedule.spaced(Duration.millis(JOB_POLL_INTERVAL_MS)),
      times: JOB_POLL_MAX_ATTEMPTS - 1,
      until: (status) => status === "done",
    }),
    Effect.flatMap((status) =>
      status === "done"
        ? Effect.void
        : Effect.fail(new Error("Tinybird delete job timed out"))
    )
  );
}

async function submitDelete(
  datasource: string,
  condition: string
): Promise<string | undefined> {
  const response = await fetch(
    `${tinybirdBaseUrl()}/v0/datasources/${datasource}/delete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TINYBIRD_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ delete_condition: condition }),
      signal: AbortSignal.timeout(TINYBIRD_MUTATION_TIMEOUT_MS),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Tinybird delete on ${datasource} failed (${response.status}): ${detail}`
    );
  }
  const payload: { job_id?: string; id?: string } = await response.json();
  return payload.job_id ?? payload.id;
}

function deleteFromDatasource(
  datasource: string,
  condition: string
): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: () => submitDelete(datasource, condition),
    catch: toError,
  }).pipe(Effect.flatMap((jobId) => (jobId ? waitForJob(jobId) : Effect.void)));
}

/**
 * Deletes matching rows from every datasource. `waitForJobs` also waits for
 * each Tinybird job so a failed job fails the purge and its caller can retry.
 */
async function submitDeletes(
  datasources: string[],
  condition: string,
  waitForJobs: boolean
): Promise<void> {
  if (!process.env.TINYBIRD_TOKEN) {
    if (process.env.NODE_ENV === "production" && !isDemoMode()) {
      throw new Error("TINYBIRD_TOKEN is not set, deleted analytics remain");
    }
    return;
  }
  const results = await Promise.allSettled(
    datasources.map((datasource) =>
      waitForJobs
        ? Effect.runPromise(deleteFromDatasource(datasource, condition))
        : submitDelete(datasource, condition)
    )
  );
  const errors = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `Tinybird delete failed on ${errors.length} of ${datasources.length} datasources`
    );
  }
}

export async function purgeSocialAccountData(
  input: PurgeSocialAccountInput
): Promise<void> {
  if (!process.env.TINYBIRD_TOKEN) {
    return;
  }
  const condition = `organization_id = ${id(input.organizationId, "organization id")} AND provider = ${id(input.provider, "provider")} AND provider_account_id = ${literal(input.providerAccountId, EXTERNAL_ID_PATTERN, "account id")}`;
  const program = Effect.gen(function* () {
    yield* Effect.forEach(
      ACCOUNT_SCOPED_DATASOURCES,
      (datasource) => deleteFromDatasource(datasource, condition),
      { discard: true }
    );
    yield* Effect.tryPromise(() =>
      bumpAnalyticsVersions("social", [input.organizationId])
    );
  });
  await Effect.runPromise(program);
}

export async function purgeGeoProjectData(
  input: PurgeGeoProjectInput
): Promise<void> {
  if (!process.env.TINYBIRD_TOKEN) {
    return;
  }
  const condition = `organization_id = ${id(input.organizationId, "organization id")} AND project_id = ${id(input.projectId, "project id")}`;
  const program = Effect.gen(function* () {
    yield* Effect.forEach(
      GEO_DATASOURCES,
      (datasource) => deleteFromDatasource(datasource, condition),
      { discard: true }
    );
    yield* Effect.tryPromise(() =>
      advancePurgeGeneration("geo", input.organizationId)
    );
  });
  await Effect.runPromise(program);
}

/**
 * Removes every GEO and web analytics row of a deleted project. The immediate
 * purge only submits the delete jobs: nothing reads a deleted project, so the
 * request does not wait for Tinybird. The delayed purge waits for them.
 */
export async function purgeDeletedProjectAnalytics(
  input: PurgeGeoProjectInput,
  waitForJobs = false
): Promise<void> {
  await submitDeletes(
    unique(
      GEO_DATASOURCES,
      WEB_DATASOURCES,
      MCP_DATASOURCES,
      IMPORTED_DATASOURCES
    ),
    `organization_id = ${id(input.organizationId, "organization id")} AND project_id = ${id(input.projectId, "project id")}`,
    waitForJobs
  );
}

export async function purgeDeletedOrganizationAnalytics(
  input: PurgeOrganizationInput,
  waitForJobs = false
): Promise<void> {
  await submitDeletes(
    unique(
      ACCOUNT_SCOPED_DATASOURCES,
      GEO_DATASOURCES,
      WEB_DATASOURCES,
      MCP_DATASOURCES,
      IMPORTED_DATASOURCES
    ),
    `organization_id = ${id(input.organizationId, "organization id")}`,
    waitForJobs
  );
}

export async function purgeDeletedSiteAnalytics(
  input: PurgeSiteInput,
  waitForJobs = false
): Promise<void> {
  await submitDeletes(
    unique(GEO_DATASOURCES, WEB_DATASOURCES),
    `organization_id = ${id(input.organizationId, "organization id")} AND site_id = ${id(input.siteId, "site id")}`,
    waitForJobs
  );
}

/**
 * Deletes one import's rows, optionally only the days of one chunk, and waits
 * for Tinybird so a retried chunk never writes on top of its earlier attempt.
 */
export async function purgeImportedRows(
  input: PurgeImportedRowsInput
): Promise<void> {
  if (!process.env.TINYBIRD_TOKEN) {
    return;
  }
  const days =
    input.fromDay && input.toDay
      ? ` AND day >= toDate(${literal(input.fromDay, DAY_PATTERN, "day")}) AND day <= toDate(${literal(input.toDay, DAY_PATTERN, "day")})`
      : "";
  const condition = `organization_id = ${id(input.organizationId, "organization id")} AND import_id = ${id(input.importId, "import id")}${days}`;
  await Effect.runPromise(
    Effect.forEach(
      IMPORTED_DATASOURCES,
      (datasource) => deleteFromDatasource(datasource, condition),
      { discard: true }
    )
  );
}
