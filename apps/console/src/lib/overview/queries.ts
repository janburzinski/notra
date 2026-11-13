import "server-only";
import { db } from "@notra/db/drizzle";
import {
  agentFeedback,
  automationRuns,
  autopilotRuns,
  chatSessions,
  freeScanClaims,
  geoAgentReadinessReports,
  geoScans,
  organizations,
  posts,
  siteDeployments,
  sites,
  slackAgentRequests,
  users,
  workflowRuns,
} from "@notra/db/schema";
import { and, eq, gte, isNull, lt, ne, type SQL, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import { OVERVIEW_TOP_WORKSPACES_LIMIT } from "@/constants/overview";
import type {
  OverviewActivityDay,
  OverviewContent,
  OverviewContentType,
  OverviewGeo,
  OverviewGrowth,
  OverviewInsights,
  OverviewPeriodCount,
  OverviewPlatform,
  OverviewSignupSource,
  OverviewWorkspace,
} from "@/types/overview";

// Other apps write every row counted here, so the query cache would never see
// them change. Every read skips it.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface OverviewWindow {
  days: number;
  /** Start of the selected window, UTC midnight. */
  since: Date;
  /** Start of the same-length window before it. */
  previous: Date;
}

/** `db.execute` wants an index signature that interfaces don't carry. */
type SqlRow<T> = T & Record<string, unknown>;

function overviewWindow(days: number): OverviewWindow {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = new Date(today.getTime() - (days - 1) * MS_PER_DAY);
  return {
    days,
    since,
    previous: new Date(since.getTime() - days * MS_PER_DAY),
  };
}

function countWhere(condition: SQL | undefined) {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
}

/** Counts rows in the window and in the window before it. */
function periodCount(column: PgColumn, window: OverviewWindow) {
  return {
    current: countWhere(gte(column, window.since)),
    previous: countWhere(
      and(gte(column, window.previous), lt(column, window.since))
    ),
  };
}

function toPeriod(
  row: Partial<OverviewPeriodCount> | undefined
): OverviewPeriodCount {
  return { current: row?.current ?? 0, previous: row?.previous ?? 0 };
}

/**
 * Period counts for a table whose rows only matter inside the two windows,
 * plus the rows in the current window that match `failed`.
 */
async function countPeriods({
  table,
  column,
  window,
  failed,
  where,
}: {
  table: PgTable;
  column: PgColumn;
  window: OverviewWindow;
  failed?: SQL;
  where?: SQL;
}): Promise<OverviewPeriodCount & { failed: number }> {
  const [row] = await db
    .select({
      ...periodCount(column, window),
      failed: failed
        ? countWhere(and(gte(column, window.since), failed))
        : sql<number>`0`.mapWith(Number),
    })
    .from(table)
    .where(and(gte(column, window.previous), where))
    .$withCache(false);

  return { ...toPeriod(row), failed: row?.failed ?? 0 };
}

async function getGrowth(window: OverviewWindow) {
  const [userRow, organizationRow] = await Promise.all([
    db
      .select({
        ...periodCount(users.createdAt, window),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(users)
      .$withCache(false),
    db
      .select({
        ...periodCount(organizations.createdAt, window),
        onboarded: countWhere(
          and(
            gte(organizations.createdAt, window.since),
            eq(organizations.onboardingCompleted, true)
          )
        ),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(organizations)
      .$withCache(false),
  ]);

  return {
    signups: toPeriod(userRow[0]),
    workspaces: toPeriod(organizationRow[0]),
    onboarded: organizationRow[0]?.onboarded ?? 0,
    totalUsers: userRow[0]?.total ?? 0,
    totalWorkspaces: organizationRow[0]?.total ?? 0,
  };
}

async function getContent(window: OverviewWindow): Promise<OverviewContent> {
  const [postRows, chats, automation] = await Promise.all([
    db
      .select({
        written: periodCount(posts.createdAt, window),
        published: periodCount(posts.publishedAt, window),
      })
      .from(posts)
      .where(
        sql`${gte(posts.createdAt, window.previous)} or ${gte(posts.publishedAt, window.previous)}`
      )
      .$withCache(false),
    countPeriods({
      table: chatSessions,
      column: chatSessions.createdAt,
      window,
    }),
    countPeriods({
      table: automationRuns,
      column: automationRuns.startedAt,
      window,
      failed: eq(automationRuns.status, "failed"),
    }),
  ]);

  return {
    written: toPeriod(postRows[0]?.written),
    published: toPeriod(postRows[0]?.published),
    chats: toPeriod(chats),
    automationRuns: toPeriod(automation),
    automationFailed: automation.failed,
  };
}

async function getGeo(window: OverviewWindow): Promise<OverviewGeo> {
  const inWindow = gte(geoScans.startedAt, window.since);
  const [scanRows, readinessReports, freeScansClaimed] = await Promise.all([
    db
      .select({
        ...periodCount(geoScans.startedAt, window),
        failed: countWhere(and(inWindow, eq(geoScans.status, "failed"))),
        checks:
          sql<number>`coalesce(sum(${geoScans.checksTotal}) filter (where ${inWindow}), 0)`.mapWith(
            Number
          ),
        costUsd:
          sql<number>`coalesce(sum(${geoScans.totalUsd}) filter (where ${inWindow}), 0)`.mapWith(
            Number
          ),
        medianDurationMs: sql<
          number | null
        >`percentile_cont(0.5) within group (order by ${geoScans.durationMs}) filter (where ${inWindow} and ${geoScans.status} = 'completed')`.mapWith(
          Number
        ),
      })
      .from(geoScans)
      .where(gte(geoScans.startedAt, window.previous))
      .$withCache(false),
    countPeriods({
      table: geoAgentReadinessReports,
      column: geoAgentReadinessReports.createdAt,
      window,
    }),
    countPeriods({
      table: freeScanClaims,
      column: freeScanClaims.claimedAt,
      window,
    }),
  ]);
  const scans = scanRows[0];
  const median = scans?.medianDurationMs ?? null;

  return {
    scans: toPeriod(scans),
    scansFailed: scans?.failed ?? 0,
    checks: scans?.checks ?? 0,
    costUsd: Math.round((scans?.costUsd ?? 0) * 100) / 100,
    medianDurationMs:
      median === null || !Number.isFinite(median) ? null : Math.round(median),
    readinessReports: toPeriod(readinessReports),
    freeScansClaimed: toPeriod(freeScansClaimed),
  };
}

async function getPlatform(window: OverviewWindow): Promise<OverviewPlatform> {
  const [autopilot, workflows, sitesCreated, deployments, feedback, slack] =
    await Promise.all([
      countPeriods({
        table: autopilotRuns,
        column: autopilotRuns.startedAt,
        window,
        failed: eq(autopilotRuns.status, "failed"),
      }),
      countPeriods({
        table: workflowRuns,
        column: workflowRuns.createdAt,
        window,
        failed: eq(workflowRuns.status, "failed"),
        where: isNull(workflowRuns.parentRunId),
      }),
      countPeriods({ table: sites, column: sites.createdAt, window }),
      countPeriods({
        table: siteDeployments,
        column: siteDeployments.createdAt,
        window,
        failed: eq(siteDeployments.status, "failed"),
      }),
      countPeriods({
        table: agentFeedback,
        column: agentFeedback.createdAt,
        window,
      }),
      countPeriods({
        table: slackAgentRequests,
        column: slackAgentRequests.createdAt,
        window,
        where: ne(slackAgentRequests.status, "blocked"),
      }),
    ]);

  return {
    autopilotRuns: toPeriod(autopilot),
    autopilotFailed: autopilot.failed,
    workflowRuns: toPeriod(workflows),
    workflowFailed: workflows.failed,
    sitesCreated: toPeriod(sitesCreated),
    deployments: toPeriod(deployments),
    deploymentsFailed: deployments.failed,
    feedback: toPeriod(feedback),
    slackRequests: toPeriod(slack),
  };
}

/**
 * One row per thing a workspace did. Timestamps are compared as ISO strings:
 * the columns are UTC `timestamp`s, and node-postgres would otherwise send a
 * Date in the server's local zone.
 */
function workspaceActivity(from: Date) {
  const start = from.toISOString();
  return sql`
    select ${posts.organizationId} as organization_id, ${posts.createdAt} as at, 'content' as kind
    from ${posts} where ${posts.createdAt} >= ${start}
    union all
    select ${geoScans.organizationId}, ${geoScans.startedAt}, 'scan'
    from ${geoScans} where ${geoScans.startedAt} >= ${start}
    union all
    select ${chatSessions.organizationId}, ${chatSessions.createdAt}, 'chat'
    from ${chatSessions} where ${chatSessions.createdAt} >= ${start}
    union all
    select ${autopilotRuns.organizationId}, ${autopilotRuns.startedAt}, 'autopilot'
    from ${autopilotRuns} where ${autopilotRuns.startedAt} >= ${start}
  `;
}

async function getActiveWorkspaces(
  window: OverviewWindow
): Promise<OverviewPeriodCount> {
  const since = window.since.toISOString();
  const result = await db.execute<SqlRow<OverviewPeriodCount>>(sql`
    select
      (count(distinct organization_id) filter (where at >= ${since}))::int as current,
      (count(distinct organization_id) filter (where at < ${since}))::int as previous
    from (${workspaceActivity(window.previous)}) activity
  `);
  return toPeriod(result.rows[0]);
}

async function getTopWorkspaces(
  window: OverviewWindow
): Promise<OverviewWorkspace[]> {
  const result = await db.execute<SqlRow<OverviewWorkspace>>(sql`
    select
      activity.organization_id as "organizationId",
      ${organizations.name} as name,
      ${organizations.slug} as slug,
      (count(*) filter (where kind = 'content'))::int as content,
      (count(*) filter (where kind = 'scan'))::int as scans,
      (count(*) filter (where kind = 'chat'))::int as chats,
      (count(*) filter (where kind = 'autopilot'))::int as "autopilotRuns",
      count(*)::int as total
    from (${workspaceActivity(window.since)}) activity
    join ${organizations} on ${organizations.id} = activity.organization_id
    group by 1, 2, 3
    order by total desc, name
    limit ${OVERVIEW_TOP_WORKSPACES_LIMIT}
  `);
  return result.rows;
}

type ActivityKind = Exclude<keyof OverviewActivityDay, "day">;

async function getActivity(
  window: OverviewWindow
): Promise<OverviewActivityDay[]> {
  const start = window.since.toISOString();
  const result = await db.execute<
    SqlRow<{ day: string; kind: ActivityKind; total: number }>
  >(sql`
    select to_char(date_trunc('day', at), 'YYYY-MM-DD') as day, kind, count(*)::int as total
    from (
      select ${users.createdAt} as at, 'signups' as kind
      from ${users} where ${users.createdAt} >= ${start}
      union all
      select ${organizations.createdAt}, 'workspaces'
      from ${organizations} where ${organizations.createdAt} >= ${start}
      union all
      select ${posts.createdAt}, 'content'
      from ${posts} where ${posts.createdAt} >= ${start}
      union all
      select ${geoScans.startedAt}, 'scans'
      from ${geoScans} where ${geoScans.startedAt} >= ${start}
      union all
      select ${chatSessions.createdAt}, 'chats'
      from ${chatSessions} where ${chatSessions.createdAt} >= ${start}
    ) events
    group by 1, 2
  `);

  const totals = new Map(
    result.rows.map((row) => [`${row.day}:${row.kind}`, row.total])
  );
  return Array.from({ length: window.days }, (_, index) => {
    const day = new Date(window.since.getTime() + index * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    const total = (kind: ActivityKind) => totals.get(`${day}:${kind}`) ?? 0;
    return {
      day,
      signups: total("signups"),
      workspaces: total("workspaces"),
      content: total("content"),
      scans: total("scans"),
      chats: total("chats"),
    };
  });
}

async function getContentTypes(
  window: OverviewWindow
): Promise<OverviewContentType[]> {
  return db
    .select({
      contentType: posts.contentType,
      written: countWhere(gte(posts.createdAt, window.since)),
      published: countWhere(gte(posts.publishedAt, window.since)),
    })
    .from(posts)
    .where(
      sql`${gte(posts.createdAt, window.since)} or ${gte(posts.publishedAt, window.since)}`
    )
    .groupBy(posts.contentType)
    .orderBy(sql`2 desc`)
    .$withCache(false);
}

async function getSignupSources(
  window: OverviewWindow
): Promise<OverviewSignupSource[]> {
  const source = sql<string>`coalesce(${organizations.heardAboutNotraSource}, 'unknown')`;
  return db
    .select({
      source,
      workspaces: sql<number>`count(*)`.mapWith(Number),
    })
    .from(organizations)
    .where(gte(organizations.createdAt, window.since))
    .groupBy(source)
    .orderBy(sql`2 desc`)
    .$withCache(false);
}

export async function getOverviewInsights(
  days: number
): Promise<OverviewInsights> {
  const window = overviewWindow(days);
  const [
    growth,
    activeWorkspaces,
    content,
    geo,
    platform,
    activity,
    contentTypes,
    signupSources,
    workspaces,
  ] = await Promise.all([
    getGrowth(window),
    getActiveWorkspaces(window),
    getContent(window),
    getGeo(window),
    getPlatform(window),
    getActivity(window),
    getContentTypes(window),
    getSignupSources(window),
    getTopWorkspaces(window),
  ]);

  const fullGrowth: OverviewGrowth = { ...growth, activeWorkspaces };
  return {
    days,
    growth: fullGrowth,
    content,
    geo,
    platform,
    activity,
    contentTypes,
    signupSources,
    workspaces,
  };
}
