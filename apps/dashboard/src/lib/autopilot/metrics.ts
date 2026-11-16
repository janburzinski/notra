import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRunEvents,
  autopilotRuns,
  autopilotSettings,
} from "@notra/db/schema";
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  like,
  lte,
  not,
  or,
  sql,
} from "drizzle-orm";

import {
  AUTOPILOT_CREDITS_CHARGED_EVENT,
  AUTOPILOT_LEGACY_PR_CREATED_MESSAGE_PATTERN,
  AUTOPILOT_PULL_REQUEST_CREATED_EVENT,
} from "@/constants/autopilot";
import {
  AUTOPILOT_JOB_OFF_MESSAGE,
  AUTOPILOT_RUN_HISTORY_DAYS,
} from "@/constants/autopilot-run-history";
import type {
  AutopilotAutomationKind,
  AutopilotMetrics,
  AutopilotMetricsDays,
  AutopilotRunDay,
} from "@/types/autopilot-metrics";

const DAY_MS = 24 * 60 * 60 * 1000;

/** An action event that opened a pull request, in the new or the legacy wording. */
const pullRequestCreated = or(
  eq(
    sql`${autopilotRunEvents.data}->>'event'`,
    AUTOPILOT_PULL_REQUEST_CREATED_EVENT
  ),
  and(
    sql`${autopilotRunEvents.data}->>'event' is null`,
    like(
      autopilotRunEvents.message,
      AUTOPILOT_LEGACY_PR_CREATED_MESSAGE_PATTERN
    )
  )
);

/** "2026-11-16" for a moment in a time zone. */
function calendarDate(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * What each automation did on each of the last calendar days in the
 * workspace's time zone, oldest first, today last.
 */
export async function loadAutopilotRunHistory(
  organizationId: string,
  now = new Date()
): Promise<Record<AutopilotAutomationKind, AutopilotRunDay[]>> {
  const settings = await db.query.autopilotSettings.findFirst({
    columns: { timezone: true },
    where: eq(autopilotSettings.organizationId, organizationId),
  });
  const timeZone = settings?.timezone ?? "UTC";
  // Counted back in calendar days from today, not in 24-hour steps, so a
  // daylight saving change can't skip or repeat a date.
  const [year, month, date] = calendarDate(now, timeZone)
    .split("-")
    .map(Number);
  const dates = Array.from({ length: AUTOPILOT_RUN_HISTORY_DAYS }, (_, index) =>
    new Date(
      Date.UTC(
        year ?? 1970,
        (month ?? 1) - 1,
        (date ?? 1) - (AUTOPILOT_RUN_HISTORY_DAYS - 1 - index)
      )
    )
      .toISOString()
      .slice(0, 10)
  );
  // created_at is stored as UTC without a zone; a day more than the window
  // covers the time zone offset, and rows outside the dates are dropped.
  const since = new Date(
    now.getTime() - (AUTOPILOT_RUN_HISTORY_DAYS + 1) * DAY_MS
  );
  const day = sql<string>`((${autopilotRunEvents.createdAt} at time zone 'UTC') at time zone ${timeZone})::date::text`;
  const rows = await db
    .select({
      kind: autopilotRunEvents.job,
      day,
      opened: sql<boolean>`bool_or(${and(eq(autopilotRunEvents.level, "action"), pullRequestCreated)})`,
      failed: sql<boolean>`bool_or(${autopilotRunEvents.level} = 'error')`,
    })
    .from(autopilotRunEvents)
    .where(
      and(
        eq(autopilotRunEvents.organizationId, organizationId),
        gte(autopilotRunEvents.createdAt, since),
        lte(autopilotRunEvents.createdAt, now),
        // A switched-off automation still logs a skip each run; that day
        // didn't run it.
        not(
          and(
            eq(autopilotRunEvents.level, "skip"),
            eq(autopilotRunEvents.message, AUTOPILOT_JOB_OFF_MESSAGE)
          ) ?? sql`false`
        )
      )
    )
    // By position: the day expression binds the time zone, and two bound
    // parameters never count as the same expression in GROUP BY.
    .groupBy(sql`1`, sql`2`);
  const history = Object.fromEntries(
    AUTOPILOT_AUTOMATION_KINDS.map((kind) => [
      kind,
      dates.map((date) => ({ date, state: "idle" as const })),
    ])
  ) as Record<AutopilotAutomationKind, AutopilotRunDay[]>;
  for (const row of rows) {
    const entry = history[row.kind as AutopilotAutomationKind]?.find(
      (candidate) => candidate.date === row.day
    );
    if (!entry) {
      continue;
    }
    // A pull request outweighs a failure the same day: something shipped.
    if (row.opened) {
      entry.state = "opened";
    } else {
      entry.state = row.failed ? "failed" : "ran";
    }
  }
  return history;
}

/** Aggregate the full reporting period, not the paginated activity preview. */
export async function loadAutopilotMetrics(
  organizationId: string,
  days: AutopilotMetricsDays,
  now = new Date()
): Promise<AutopilotMetrics> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const [created, merged, usage, runs] = await Promise.all([
    db
      .select({
        kind: autopilotRunEvents.job,
        total: countDistinct(sql`${autopilotRunEvents.data}->>'url'`),
      })
      .from(autopilotRunEvents)
      .innerJoin(autopilotRuns, eq(autopilotRuns.id, autopilotRunEvents.runId))
      .where(
        and(
          eq(autopilotRunEvents.organizationId, organizationId),
          eq(autopilotRuns.organizationId, organizationId),
          eq(autopilotRunEvents.level, "action"),
          gte(autopilotRunEvents.createdAt, since),
          lte(autopilotRunEvents.createdAt, now),
          pullRequestCreated
        )
      )
      .groupBy(autopilotRunEvents.job),
    db
      .select({ kind: autopilotFindings.kind, total: count() })
      .from(autopilotFindings)
      .where(
        and(
          eq(autopilotFindings.organizationId, organizationId),
          eq(autopilotFindings.status, "merged"),
          gte(autopilotFindings.mergedAt, since),
          lte(autopilotFindings.mergedAt, now)
        )
      )
      .groupBy(autopilotFindings.kind),
    // A job ran in a run when it logged anything there.
    db
      .select({
        kind: autopilotRunEvents.job,
        runs: countDistinct(autopilotRunEvents.runId),
        credits:
          sql<number>`coalesce(sum((${autopilotRunEvents.data}->>'credits')::numeric) filter (where ${autopilotRunEvents.data}->>'event' = ${AUTOPILOT_CREDITS_CHARGED_EVENT}), 0)`.mapWith(
            Number
          ),
      })
      .from(autopilotRunEvents)
      .where(
        and(
          eq(autopilotRunEvents.organizationId, organizationId),
          gte(autopilotRunEvents.createdAt, since),
          lte(autopilotRunEvents.createdAt, now)
        )
      )
      .groupBy(autopilotRunEvents.job),
    db
      .select({ runs: count() })
      .from(autopilotRuns)
      .where(
        and(
          eq(autopilotRuns.organizationId, organizationId),
          gte(autopilotRuns.startedAt, since),
          lte(autopilotRuns.startedAt, now)
        )
      ),
  ]);
  const createdByKind = new Map(created.map((row) => [row.kind, row.total]));
  const usageByKind = new Map(usage.map((row) => [row.kind, row]));
  const totalCredits = usage.reduce((total, row) => total + row.credits, 0);
  const runCount = runs[0]?.runs ?? 0;
  const mergedByKind = new Map(merged.map((row) => [row.kind, row.total]));
  const automations = AUTOPILOT_AUTOMATION_KINDS.map((kind) => {
    const used = usageByKind.get(kind);
    return {
      kind,
      pullRequests: createdByKind.get(kind) ?? 0,
      merged: mergedByKind.get(kind) ?? 0,
      creditsPerRun: used?.runs ? roundCredits(used.credits / used.runs) : 0,
    };
  });
  return {
    days,
    pullRequests: automations.reduce(
      (total, row) => total + row.pullRequests,
      0
    ),
    merged: automations.reduce((total, row) => total + row.merged, 0),
    averageCreditsPerRun: runCount ? roundCredits(totalCredits / runCount) : 0,
    totalCredits: roundCredits(totalCredits),
    automations,
  };
}

function roundCredits(value: number) {
  return Math.round(value * 10) / 10;
}
