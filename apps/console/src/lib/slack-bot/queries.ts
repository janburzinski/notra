import "server-only";
import { db } from "@notra/db/drizzle";
import { organizations, slackAgentRequests } from "@notra/db/schema";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";

import {
  SLACK_BOT_TOP_TOOLS_LIMIT,
  SLACK_BOT_TOP_WORKSPACES_LIMIT,
  SLACK_BOT_UNANSWERED_AFTER_MS,
} from "@/constants/slack-bot";
import type {
  SlackBotActivityDay,
  SlackBotInsights,
  SlackBotSummary,
  SlackBotThreadStats,
  SlackBotToolUsage,
  SlackBotWorkspace,
} from "@/types/slack-bot";

// The agent writes these rows, so the console's query cache would never see
// them change. Every read skips it.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const table = slackAgentRequests;
const responseMs = sql`extract(epoch from (${table.firstResponseAt} - ${table.sentAt})) * 1000`;

function countWhere(condition: ReturnType<typeof sql>) {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
}

function responsePercentile(fraction: number) {
  return sql<
    number | null
  >`percentile_cont(${fraction}) within group (order by ${responseMs})`.mapWith(
    Number
  );
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function windowStart(days: number): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(today.getTime() - (days - 1) * MS_PER_DAY);
}

function roundOrNull(value: number | null, digits = 0): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function getSummary(since: Date): Promise<SlackBotSummary> {
  const unansweredBefore = new Date(Date.now() - SLACK_BOT_UNANSWERED_AFTER_MS);
  const handled = sql`${table.status} <> 'blocked'`;
  const [row] = await db
    .select({
      requests: countWhere(handled),
      mentions: countWhere(sql`${handled} and ${table.trigger} = 'mention'`),
      directMessages: countWhere(
        sql`${handled} and ${table.trigger} = 'direct_message'`
      ),
      threadReplies: countWhere(
        sql`${handled} and ${table.trigger} = 'thread_reply'`
      ),
      blocked: countWhere(sql`${table.status} = 'blocked'`),
      completed: countWhere(sql`${table.status} = 'completed'`),
      failed: countWhere(sql`${table.status} = 'failed'`),
      cancelled: countWhere(sql`${table.status} = 'cancelled'`),
      unanswered: countWhere(
        sql`${table.status} = 'pending' and ${isNull(table.firstResponseAt)} and ${lt(table.createdAt, unansweredBefore)}`
      ),
      users:
        sql<number>`count(distinct ${table.slackUserId}) filter (where ${handled})`.mapWith(
          Number
        ),
      workspaces:
        sql<number>`count(distinct ${table.organizationId}) filter (where ${handled})`.mapWith(
          Number
        ),
      medianResponseMs: responsePercentile(0.5),
      p90ResponseMs: responsePercentile(0.9),
      averageResponseMs: sql<number | null>`avg(${responseMs})`.mapWith(Number),
    })
    .from(table)
    .where(gte(table.createdAt, since))
    .$withCache(false);

  return {
    requests: row?.requests ?? 0,
    mentions: row?.mentions ?? 0,
    directMessages: row?.directMessages ?? 0,
    threadReplies: row?.threadReplies ?? 0,
    blocked: row?.blocked ?? 0,
    completed: row?.completed ?? 0,
    failed: row?.failed ?? 0,
    cancelled: row?.cancelled ?? 0,
    unanswered: row?.unanswered ?? 0,
    users: row?.users ?? 0,
    workspaces: row?.workspaces ?? 0,
    medianResponseMs: roundOrNull(row?.medianResponseMs ?? null),
    p90ResponseMs: roundOrNull(row?.p90ResponseMs ?? null),
    averageResponseMs: roundOrNull(row?.averageResponseMs ?? null),
  };
}

async function getThreadStats(since: Date): Promise<SlackBotThreadStats> {
  const threads = db
    .select({ turns: count().as("turns") })
    .from(table)
    .where(and(gte(table.createdAt, since), ne(table.status, "blocked")))
    .groupBy(table.slackTeamId, table.channelId, table.threadTs)
    .as("threads");

  const [row] = await db
    .select({
      threads: count(),
      averageTurns: sql<number | null>`avg(${threads.turns})`.mapWith(Number),
      maxTurns: sql<number>`coalesce(max(${threads.turns}), 0)`.mapWith(Number),
      multiTurnThreads: countWhere(sql`${threads.turns} > 1`),
    })
    .from(threads)
    .$withCache(false);

  return {
    threads: row?.threads ?? 0,
    averageTurns: roundOrNull(row?.averageTurns ?? null, 1),
    maxTurns: row?.maxTurns ?? 0,
    multiTurnThreads: row?.multiTurnThreads ?? 0,
  };
}

async function getActivity(
  since: Date,
  days: number
): Promise<SlackBotActivityDay[]> {
  const day = sql<string>`to_char(date_trunc('day', ${table.createdAt}), 'YYYY-MM-DD')`;
  const rows = await db
    .select({
      day,
      completed: countWhere(sql`${table.status} = 'completed'`),
      failed: countWhere(sql`${table.status} = 'failed'`),
      other: countWhere(sql`${table.status} in ('pending', 'cancelled')`),
      medianResponseMs: responsePercentile(0.5),
    })
    .from(table)
    .where(gte(table.createdAt, since))
    .groupBy(day)
    .$withCache(false);

  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const key = dayKey(new Date(since.getTime() + index * MS_PER_DAY));
    const row = byDay.get(key);
    const median = row?.medianResponseMs ?? null;
    return {
      day: key,
      completed: row?.completed ?? 0,
      failed: row?.failed ?? 0,
      other: row?.other ?? 0,
      medianResponseSeconds:
        median === null ? null : roundOrNull(median / 1000, 1),
    };
  });
}

async function getTopTools(since: Date): Promise<SlackBotToolUsage[]> {
  const rows = await db
    .select({
      tool: sql<string>`unnest(${table.toolNames})`,
      calls: count(),
    })
    .from(table)
    .where(gte(table.createdAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`, sql`1`)
    .limit(SLACK_BOT_TOP_TOOLS_LIMIT)
    .$withCache(false);
  return rows;
}

async function getWorkspaces(since: Date): Promise<SlackBotWorkspace[]> {
  const rows = await db
    .select({
      organizationId: table.organizationId,
      name: organizations.name,
      slug: organizations.slug,
      requests: count(),
      users: countDistinct(table.slackUserId),
      failed: countWhere(sql`${table.status} = 'failed'`),
      medianResponseMs: responsePercentile(0.5),
    })
    .from(table)
    .innerJoin(organizations, eq(organizations.id, table.organizationId))
    .where(and(gte(table.createdAt, since), ne(table.status, "blocked")))
    .groupBy(table.organizationId, organizations.name, organizations.slug)
    .orderBy(desc(count()))
    .limit(SLACK_BOT_TOP_WORKSPACES_LIMIT)
    .$withCache(false);

  return rows.map((row) => ({
    ...row,
    medianResponseMs: roundOrNull(row.medianResponseMs),
  }));
}

export async function getSlackBotInsights(
  days: number
): Promise<SlackBotInsights> {
  const since = windowStart(days);
  const [summary, threads, activity, tools, workspaces] = await Promise.all([
    getSummary(since),
    getThreadStats(since),
    getActivity(since, days),
    getTopTools(since),
    getWorkspaces(since),
  ]);
  return { days, summary, threads, activity, tools, workspaces };
}
