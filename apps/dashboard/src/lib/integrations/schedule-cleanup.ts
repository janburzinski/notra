import { deleteQstashSchedule } from "@notra/ai/qstash/triggers";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { contentTriggers } from "@notra/db/schema";
import { mapWithConcurrency } from "@notra/sites-server/utils/concurrency";
import { and, eq, inArray, or, sql } from "drizzle-orm";

function schedulesTargetingIntegration(
  organizationId: string,
  integrationId: string
) {
  const match = JSON.stringify([integrationId]);
  return and(
    eq(contentTriggers.organizationId, organizationId),
    eq(contentTriggers.sourceType, "cron"),
    or(
      sql`${contentTriggers.targets} -> 'repositoryIds' @> ${match}::jsonb`,
      sql`${contentTriggers.targets} -> 'linearIntegrationIds' @> ${match}::jsonb`
    )
  );
}

export function getAffectedSchedulesForIntegration(
  organizationId: string,
  integrationId: string
) {
  return db.query.contentTriggers.findMany({
    columns: {
      enabled: true,
      id: true,
      name: true,
    },
    where: schedulesTargetingIntegration(organizationId, integrationId),
  });
}

/**
 * Disables the schedules that target an integration before it is deleted. The
 * rows are locked and rechecked, so a schedule moved to another integration in
 * the meantime is left alone. QStash schedules are removed after the commit.
 */
export async function disableSchedulesForIntegration(
  organizationId: string,
  integrationId: string
) {
  const disabled = await db.transaction(async (tx) => {
    const schedules = await tx
      .select({
        id: contentTriggers.id,
        name: contentTriggers.name,
        qstashScheduleId: contentTriggers.qstashScheduleId,
      })
      .from(contentTriggers)
      .where(schedulesTargetingIntegration(organizationId, integrationId))
      .for("update");

    if (schedules.length > 0) {
      await tx
        .update(contentTriggers)
        .set({
          enabled: false,
          qstashScheduleId: null,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            contentTriggers.id,
            schedules.map((schedule) => schedule.id)
          )
        );
    }

    return schedules;
  });

  await mapWithConcurrency(disabled, 4, async (schedule) => {
    if (!schedule.qstashScheduleId) {
      return;
    }

    await deleteQstashSchedule(schedule.qstashScheduleId).catch((error) => {
      logError("Failed to delete qstash schedule", error, {
        scheduleId: schedule.qstashScheduleId,
      });
    });
  });

  return disabled;
}
