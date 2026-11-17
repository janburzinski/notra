import "server-only";
import {
  AUTOPILOT_DEFAULT_JOBS,
  AUTOPILOT_JOB_KINDS,
  AUTOPILOT_SCHEDULED_TRIGGERS,
} from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import { type SQL, sql } from "drizzle-orm";

import {
  AUTOPILOT_CUSTOM_WORKFLOW_KEY_PREFIX,
  AUTOPILOT_FULL_RUN_WORKFLOW_KEY,
  AUTOPILOT_HEALTH_FAILURE_LIMIT,
  AUTOPILOT_HEALTH_MESSAGE_CHARS,
  AUTOPILOT_HEALTH_STUCK_LIMIT,
  AUTOPILOT_HEALTH_WORKFLOW_LIMIT,
  AUTOPILOT_HEALTH_WORKSPACE_LIMIT,
  AUTOPILOT_HEARTBEAT_WARNING_MS,
} from "@/constants/autopilot";
import type {
  AutopilotHealth,
  AutopilotHealthBucket,
  AutopilotHealthFailure,
  AutopilotHealthStuckRun,
  AutopilotHealthTemplate,
  AutopilotHealthTotals,
  AutopilotHealthWorkflow,
  AutopilotHealthWorkflows,
  AutopilotHealthWorkspace,
} from "@/types/autopilot";

// The dashboard and its workers write every row read here, so nothing is
// cached. Timestamps are UTC `timestamp` columns and are compared with ISO
// strings: node-postgres would send a Date in the server's local zone.

const DAY_MS = 24 * 60 * 60 * 1000;

/** `db.execute` wants an index signature that interfaces don't carry. */
type SqlRow<T> = T & Record<string, unknown>;

interface HealthWindow {
  days: number;
  now: string;
  since: string;
  previous: string;
}

/**
 * One day is the last 24 hours, by hour. Longer ranges are whole UTC days,
 * today included, so the chart never starts with a partial day. The window
 * compared against is as long as the elapsed part of this one, so an
 * unfinished today doesn't read as a drop.
 */
function healthWindow(days: number, now = new Date()): HealthWindow {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const since =
    days <= 1 ? now.getTime() - DAY_MS : today.getTime() - (days - 1) * DAY_MS;
  return {
    days,
    now: now.toISOString(),
    since: new Date(since).toISOString(),
    previous: new Date(since - (now.getTime() - since)).toISOString(),
  };
}

/**
 * A draft is a finding with a pull request, as on the dashboard's Analytics
 * tab. Findings from before `opened_at` existed opened with the finding.
 */
const draftOpenedAt = sql`coalesce(opened_at, created_at)`;
const isDraft = sql`pull_request_url is not null`;

/** Running runs whose last heartbeat is older than this have stopped reporting. */
function stale(window: HealthWindow) {
  return new Date(
    new Date(window.now).getTime() - AUTOPILOT_HEARTBEAT_WARNING_MS
  ).toISOString();
}

function iso(column: SQL) {
  return sql`to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

/** Each job kind with whether a workspace that never stored it has it on. */
const jobDefaults = sql`(values ${sql.join(
  AUTOPILOT_JOB_KINDS.map(
    (kind) => sql`(${kind}, ${AUTOPILOT_DEFAULT_JOBS[kind]}::boolean)`
  ),
  sql`, `
)}) as job_defaults(kind, default_on)`;

/** Whether a template is on for the `s` settings row, defaults included. */
const jobOn = sql`coalesce((s.jobs ->> job_defaults.kind)::boolean, job_defaults.default_on)`;

const scheduledTriggers = sql.join(
  AUTOPILOT_SCHEDULED_TRIGGERS.map((trigger) => sql`${trigger}`),
  sql`, `
);

/**
 * A completed run of every template. Running one template from the dashboard
 * uses the same triggers with its own workflow key, so the key tells them apart.
 */
const fullRun = sql`status = 'completed'
  and trigger in (${scheduledTriggers})
  and coalesce(workflow_key, ${AUTOPILOT_FULL_RUN_WORKFLOW_KEY}) = ${AUTOPILOT_FULL_RUN_WORKFLOW_KEY}`;

function finite(value: unknown): number | null {
  const number = value === null ? Number.NaN : Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

async function getRunTotals(window: HealthWindow) {
  const result = await db.execute<
    SqlRow<{
      runs: number;
      previousRuns: number;
      failed: number;
      previousFailed: number;
      stopped: number;
      activeWorkspaces: number;
      medianDurationMs: string | null;
      p90DurationMs: string | null;
    }>
  >(sql`
    select
      (count(*) filter (where started_at >= ${window.since}))::int as runs,
      (count(*) filter (where started_at < ${window.since}))::int as "previousRuns",
      (count(*) filter (where started_at >= ${window.since} and status = 'failed'))::int as failed,
      (count(*) filter (where started_at < ${window.since} and status = 'failed'))::int as "previousFailed",
      (count(*) filter (where started_at >= ${window.since} and status = 'stopped'))::int as stopped,
      (count(distinct organization_id) filter (where started_at >= ${window.since}))::int as "activeWorkspaces",
      percentile_cont(0.5) within group (order by extract(epoch from finished_at - started_at) * 1000)
        filter (where started_at >= ${window.since} and ${fullRun}) as "medianDurationMs",
      percentile_cont(0.9) within group (order by extract(epoch from finished_at - started_at) * 1000)
        filter (where started_at >= ${window.since} and ${fullRun}) as "p90DurationMs"
    from autopilot_runs
    where started_at >= ${window.previous}
  `);
  return result.rows[0];
}

async function getLiveRuns(window: HealthWindow) {
  const [counts, stuck] = await Promise.all([
    db.execute<SqlRow<{ running: number; enabled: number }>>(sql`
      select
        (select count(*) from autopilot_runs where status = 'running')::int as running,
        (select count(*) from autopilot_settings where enabled)::int as enabled
    `),
    db.execute<SqlRow<AutopilotHealthStuckRun>>(sql`
      select
        r.id,
        o.slug as "organizationSlug",
        ${iso(sql`r.started_at`)} as "startedAt",
        ${iso(sql`r.heartbeat_at`)} as "heartbeatAt"
      from autopilot_runs r
      join organizations o on o.id = r.organization_id
      where r.status = 'running' and r.heartbeat_at < ${stale(window)}
      order by r.heartbeat_at
      limit ${AUTOPILOT_HEALTH_STUCK_LIMIT}
    `),
  ]);
  return {
    running: counts.rows[0]?.running ?? 0,
    enabled: counts.rows[0]?.enabled ?? 0,
    stuck: stuck.rows,
  };
}

async function getBuckets(
  window: HealthWindow
): Promise<AutopilotHealthBucket[]> {
  // A fixed literal, never user input.
  const unit = sql.raw(window.days <= 1 ? "'hour'" : "'day'");
  const result = await db.execute<SqlRow<AutopilotHealthBucket>>(sql`
    select
      ${iso(sql`bucket`)} as at,
      (count(r.id) filter (where r.status = 'completed'))::int as completed,
      (count(r.id) filter (where r.status = 'failed'))::int as failed,
      (count(r.id) filter (where r.status = 'stopped'))::int as stopped
    from generate_series(
      date_trunc(${unit}, ${window.since}::timestamp),
      date_trunc(${unit}, ${window.now}::timestamp),
      ('1 ' || ${unit})::interval
    ) as bucket
    left join autopilot_runs r
      on r.started_at >= ${window.since}
      and date_trunc(${unit}, r.started_at) = bucket
    group by bucket
    order by bucket
  `);
  return result.rows;
}

async function getTemplates(window: HealthWindow): Promise<{
  templates: AutopilotHealthTemplate[];
  credits: number;
}> {
  const [enabled, findings, events] = await Promise.all([
    db.execute<SqlRow<{ kind: AutopilotJobKind; workspaces: number }>>(sql`
      select job_defaults.kind, (count(s.organization_id) filter (where ${jobOn}))::int as workspaces
      from ${jobDefaults}
      left join autopilot_settings s on s.enabled
      group by job_defaults.kind
    `),
    db.execute<
      SqlRow<{
        kind: AutopilotJobKind;
        ideas: number;
        drafts: number;
        merged: number;
        dismissed: number;
        expired: number;
        failedFindings: number;
        inReview: number;
      }>
    >(sql`
      select
        kind,
        (count(*) filter (where created_at >= ${window.since}))::int as ideas,
        (count(*) filter (where ${isDraft} and ${draftOpenedAt} >= ${window.since}))::int as drafts,
        (count(*) filter (where status = 'merged' and merged_at >= ${window.since}))::int as merged,
        (count(*) filter (where ${isDraft} and status = 'dismissed' and dismissed_at >= ${window.since}))::int as dismissed,
        (count(*) filter (where ${isDraft} and status = 'expired' and dismissed_at >= ${window.since}))::int as expired,
        (count(*) filter (where status = 'failed' and updated_at >= ${window.since}))::int as "failedFindings",
        (count(*) filter (where status = 'proposed'))::int as "inReview"
      from autopilot_findings
      where status = 'proposed'
        or created_at >= ${window.since}
        or opened_at >= ${window.since}
        or merged_at >= ${window.since}
        or dismissed_at >= ${window.since}
        or updated_at >= ${window.since}
      group by kind
    `),
    // Joined through the runs so the events' run index does the work.
    db.execute<
      SqlRow<{
        kind: AutopilotJobKind | null;
        runs: number;
        failedRuns: number;
        errors: number;
        credits: number;
      }>
    >(sql`
      select
        e.job as kind,
        (count(distinct e.run_id) filter (where e.level <> 'skip'))::int as runs,
        (count(distinct e.run_id) filter (where e.level = 'error'))::int as "failedRuns",
        (count(*) filter (where e.level = 'error'))::int as errors,
        coalesce(sum((e.data ->> 'credits')::numeric) filter (where e.data ->> 'event' = 'credits_charged'), 0)::float as credits
      from autopilot_runs r
      join autopilot_run_events e on e.run_id = r.id
      where r.started_at >= ${window.since}
      group by e.job
    `),
  ]);
  const enabledByKind = new Map(
    enabled.rows.map((row) => [row.kind, row.workspaces])
  );
  const findingsByKind = new Map(findings.rows.map((row) => [row.kind, row]));
  const eventsByKind = new Map(events.rows.map((row) => [row.kind, row]));
  // Charges logged without a job still count towards the total.
  const credits = events.rows.reduce((total, row) => total + row.credits, 0);
  const templates = AUTOPILOT_JOB_KINDS.map((kind) => {
    const finding = findingsByKind.get(kind);
    const event = eventsByKind.get(kind);
    return {
      kind,
      enabledWorkspaces: enabledByKind.get(kind) ?? 0,
      runs: event?.runs ?? 0,
      failedRuns: event?.failedRuns ?? 0,
      errors: event?.errors ?? 0,
      ideas: finding?.ideas ?? 0,
      drafts: finding?.drafts ?? 0,
      merged: finding?.merged ?? 0,
      dismissed: finding?.dismissed ?? 0,
      expired: finding?.expired ?? 0,
      failedFindings: finding?.failedFindings ?? 0,
      inReview: finding?.inReview ?? 0,
      credits: roundCredits(event?.credits ?? 0),
    };
  });
  return { templates, credits: roundCredits(credits) };
}

function roundCredits(value: number) {
  return Math.round(value * 10) / 10;
}

async function getFindingPeriods(window: HealthWindow) {
  const result = await db.execute<
    SqlRow<{
      drafts: number;
      previousDrafts: number;
      merged: number;
      previousMerged: number;
    }>
  >(sql`
    select
      (count(*) filter (where ${isDraft} and ${draftOpenedAt} >= ${window.since}))::int as drafts,
      (count(*) filter (where ${isDraft} and ${draftOpenedAt} >= ${window.previous} and ${draftOpenedAt} < ${window.since}))::int as "previousDrafts",
      (count(*) filter (where status = 'merged' and merged_at >= ${window.since}))::int as merged,
      (count(*) filter (where status = 'merged' and merged_at >= ${window.previous} and merged_at < ${window.since}))::int as "previousMerged"
    from autopilot_findings
    where ${draftOpenedAt} >= ${window.previous} or merged_at >= ${window.previous}
  `);
  return result.rows[0];
}

async function getFailures(
  window: HealthWindow
): Promise<AutopilotHealthFailure[]> {
  const result = await db.execute<SqlRow<AutopilotHealthFailure>>(sql`
    with errors as (
      select r.id as run_id, r.organization_id, e.job, e.message, e.created_at as at
      from autopilot_runs r
      join autopilot_run_events e on e.run_id = r.id
      where r.started_at >= ${window.since} and e.level = 'error'
      union all
      select id, organization_id, null, error_message, coalesce(finished_at, heartbeat_at)
      from autopilot_runs
      where started_at >= ${window.since} and status = 'failed' and error_message is not null
    ),
    grouped as (
      select
        job,
        left(regexp_replace(message, '[0-9]+', 'N', 'g'), ${AUTOPILOT_HEALTH_MESSAGE_CHARS}) as message,
        count(*)::int as occurrences,
        count(distinct run_id)::int as runs,
        count(distinct organization_id)::int as workspaces,
        max(at) as last_seen_at,
        (array_agg(run_id order by at desc))[1] as example_run_id,
        (array_agg(organization_id order by at desc))[1] as example_organization_id
      from errors
      group by 1, 2
    )
    select
      g.job,
      g.message,
      g.occurrences,
      g.runs,
      g.workspaces,
      ${iso(sql`g.last_seen_at`)} as "lastSeenAt",
      g.example_run_id as "exampleRunId",
      o.slug as "exampleOrganizationSlug"
    from grouped g
    join organizations o on o.id = g.example_organization_id
    order by g.runs desc, g.occurrences desc, g.last_seen_at desc
    limit ${AUTOPILOT_HEALTH_FAILURE_LIMIT}
  `);
  return result.rows;
}

async function getWorkspaces(
  window: HealthWindow
): Promise<AutopilotHealthWorkspace[]> {
  const result = await db.execute<SqlRow<AutopilotHealthWorkspace>>(sql`
    with runs as (
      select
        organization_id,
        count(*)::int as runs,
        (count(*) filter (where status = 'failed'))::int as failed
      from autopilot_runs
      where started_at >= ${window.since}
      group by organization_id
    ),
    findings as (
      select
        organization_id,
        (count(*) filter (where status = 'proposed'))::int as in_review,
        (count(*) filter (where status = 'merged' and merged_at >= ${window.since}))::int as merged
      from autopilot_findings
      where status = 'proposed' or merged_at >= ${window.since}
      group by organization_id
    )
    select
      o.id as "organizationId",
      o.slug,
      o.name,
      coalesce(s.enabled, false) as enabled,
      case when s.repository_owner is not null and s.repository_name is not null
        then s.repository_owner || '/' || s.repository_name end as repository,
      (s.slack_channel_id is not null and si.id is not null) as slack,
      case when s.organization_id is null then 0
        else (select count(*) from ${jobDefaults} where ${jobOn}) end::int as "jobsOn",
      coalesce(r.runs, 0) as runs,
      coalesce(r.failed, 0) as failed,
      l.id as "lastRunId",
      l.status as "lastRunStatus",
      (l.status = 'running' and l.heartbeat_at < ${stale(window)}) as "lastRunStuck",
      ${iso(sql`l.started_at`)} as "lastRunAt",
      coalesce(f.in_review, 0) as "inReview",
      coalesce(f.merged, 0) as merged
    from organizations o
    left join autopilot_settings s on s.organization_id = o.id
    -- The brief only goes out through a connection that still exists and is on.
    left join slack_integrations si
      on si.id = s.slack_integration_id
      and si.organization_id = o.id
      and si.enabled
    left join runs r on r.organization_id = o.id
    left join findings f on f.organization_id = o.id
    left join lateral (
      select id, status, started_at, heartbeat_at
      from autopilot_runs
      where organization_id = o.id
      order by started_at desc
      limit 1
    ) l on true
    where s.enabled or r.runs > 0
    order by
      coalesce(r.failed, 0) desc,
      coalesce(r.runs, 0) desc,
      l.started_at desc nulls last
    limit ${AUTOPILOT_HEALTH_WORKSPACE_LIMIT}
  `);
  return result.rows;
}

async function getWorkflows(
  window: HealthWindow
): Promise<AutopilotHealthWorkflows> {
  const prefix = AUTOPILOT_CUSTOM_WORKFLOW_KEY_PREFIX;
  const [counts, top] = await Promise.all([
    db.execute<
      SqlRow<{ total: number; enabled: number; runs: number; failed: number }>
    >(sql`
      select
        (select count(*) from autopilot_workflows)::int as total,
        (select count(*) from autopilot_workflows where enabled)::int as enabled,
        count(*)::int as runs,
        (count(*) filter (where status = 'failed'))::int as failed
      from workflow_runs
      where workflow_key like ${`${prefix}%`}
        and parent_run_id is null
        and created_at >= ${window.since}
    `),
    db.execute<SqlRow<AutopilotHealthWorkflow>>(sql`
      select
        w.id,
        w.name,
        o.slug as "organizationSlug",
        w.enabled,
        count(r.id)::int as runs,
        (count(r.id) filter (where r.status = 'failed'))::int as failed,
        ${iso(sql`max(r.created_at)`)} as "lastRunAt",
        (array_agg(r.status order by r.created_at desc) filter (where r.id is not null))[1] as "lastStatus",
        (array_agg(r.error_message order by r.created_at desc) filter (where r.status = 'failed'))[1] as "lastError"
      from autopilot_workflows w
      join organizations o on o.id = w.organization_id
      left join workflow_runs r
        on r.organization_id = w.organization_id
        and r.workflow_key = ${prefix} || w.id
        and r.parent_run_id is null
        and r.created_at >= ${window.since}
      group by w.id, o.slug
      order by failed desc, runs desc, w.updated_at desc
      limit ${AUTOPILOT_HEALTH_WORKFLOW_LIMIT}
    `),
  ]);
  const row = counts.rows[0];
  return {
    total: row?.total ?? 0,
    enabled: row?.enabled ?? 0,
    runs: row?.runs ?? 0,
    failed: row?.failed ?? 0,
    top: top.rows,
  };
}

/** Everything the console's Autopilot health view shows, across workspaces. */
export async function getAutopilotHealth(
  days: number,
  now = new Date()
): Promise<AutopilotHealth> {
  const window = healthWindow(days, now);
  const [
    runTotals,
    live,
    buckets,
    templateHealth,
    findingPeriods,
    failures,
    workspaces,
    workflows,
  ] = await Promise.all([
    getRunTotals(window),
    getLiveRuns(window),
    getBuckets(window),
    getTemplates(window),
    getFindingPeriods(window),
    getFailures(window),
    getWorkspaces(window),
    getWorkflows(window),
  ]);

  const { templates } = templateHealth;
  const totals: AutopilotHealthTotals = {
    runs: {
      current: runTotals?.runs ?? 0,
      previous: runTotals?.previousRuns ?? 0,
    },
    failed: {
      current: runTotals?.failed ?? 0,
      previous: runTotals?.previousFailed ?? 0,
    },
    stopped: runTotals?.stopped ?? 0,
    running: live.running,
    medianDurationMs: finite(runTotals?.medianDurationMs ?? null),
    p90DurationMs: finite(runTotals?.p90DurationMs ?? null),
    enabledWorkspaces: live.enabled,
    activeWorkspaces: runTotals?.activeWorkspaces ?? 0,
    drafts: {
      current: findingPeriods?.drafts ?? 0,
      previous: findingPeriods?.previousDrafts ?? 0,
    },
    merged: {
      current: findingPeriods?.merged ?? 0,
      previous: findingPeriods?.previousMerged ?? 0,
    },
    closed: templates.reduce(
      (total, row) => total + row.dismissed + row.expired,
      0
    ),
    inReview: templates.reduce((total, row) => total + row.inReview, 0),
    credits: templateHealth.credits,
  };

  return {
    days,
    generatedAt: window.now,
    totals,
    buckets,
    templates,
    failures,
    workspaces,
    workflows,
    stuck: live.stuck,
  };
}
