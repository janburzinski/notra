import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { autopilotRuns, autopilotSettings } from "@notra/db/schema";
import { mapWithConcurrency } from "@notra/sites-server/utils/concurrency";
import { and, count, eq, gte, max } from "drizzle-orm";

import {
  AUTOPILOT_CRON_CONCURRENCY,
  AUTOPILOT_CRON_INTERVAL_MINUTES,
  AUTOPILOT_DAILY_RUN_MAX_ATTEMPTS,
  AUTOPILOT_REACTION_LOOKBACK_DAYS,
  AUTOPILOT_RUN_RETRY_BACKOFF_MS,
} from "@/constants/autopilot";
import { syncOfferReactionFeedback } from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { purgeExpiredAutopilotTraceDetails } from "@/lib/autopilot/log";
import { startAutopilot } from "@/lib/autopilot/start";
import type { AutopilotSchedule } from "@/types/autopilot-runtime";
import {
  autopilotLocalDayStart,
  isAutopilotDue,
} from "@/utils/autopilot-schedule";

async function purgeTraceDetailsHourly(now: Date) {
  if (now.getUTCMinutes() >= AUTOPILOT_CRON_INTERVAL_MINUTES) {
    return;
  }
  try {
    await purgeExpiredAutopilotTraceDetails(now);
  } catch (error) {
    logError("[Autopilot] Trace detail purge failed", error);
  }
}

async function canAttemptScheduledRun(
  organizationId: string,
  schedule: AutopilotSchedule,
  now: Date
) {
  const [attempts] = await db
    .select({ total: count(), latest: max(autopilotRuns.startedAt) })
    .from(autopilotRuns)
    .where(
      and(
        eq(autopilotRuns.organizationId, organizationId),
        eq(autopilotRuns.trigger, "cron"),
        gte(
          autopilotRuns.startedAt,
          autopilotLocalDayStart(schedule.timezone, now)
        )
      )
    );
  const total = attempts?.total ?? 0;
  if (total === 0 || !attempts?.latest) {
    return true;
  }
  if (total >= AUTOPILOT_DAILY_RUN_MAX_ATTEMPTS) {
    return false;
  }
  const backoff = AUTOPILOT_RUN_RETRY_BACKOFF_MS * 2 ** (total - 1);
  return now.getTime() - attempts.latest.getTime() >= backoff;
}

export async function runDueAutopilots() {
  const now = new Date();
  const [, rows] = await Promise.all([
    purgeTraceDetailsHourly(now),
    db.query.autopilotSettings.findMany({
      where: eq(autopilotSettings.enabled, true),
    }),
  ]);
  let started = 0;
  let failed = 0;
  await mapWithConcurrency(rows, AUTOPILOT_CRON_CONCURRENCY, async (row) => {
    try {
      if (!(await isAutopilotEnabledForOrganization(row.organizationId))) {
        return;
      }
      if (now.getUTCMinutes() < AUTOPILOT_CRON_INTERVAL_MINUTES) {
        try {
          await syncOfferReactionFeedback(
            row.organizationId,
            new Date(
              now.getTime() - AUTOPILOT_REACTION_LOOKBACK_DAYS * 86400000
            )
          );
        } catch (error) {
          failed += 1;
          logError("[Autopilot] Reaction feedback sync failed", error, {
            organizationId: row.organizationId,
          });
        }
      }
      if (!isAutopilotDue(row, now)) {
        return;
      }
      if (!(await canAttemptScheduledRun(row.organizationId, row, now))) {
        return;
      }
      const claim = await startAutopilot(row.organizationId, "cron");
      if (!claim.alreadyRunning) {
        started += 1;
      }
    } catch (error) {
      failed += 1;
      logError("[Autopilot] Scheduled run failed to start", error, {
        organizationId: row.organizationId,
      });
    }
  });
  return { checked: rows.length, started, failed };
}
