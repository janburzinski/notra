import {
  buildCronExpression,
  createQstashSchedule,
  deleteQstashSchedule,
} from "@notra/ai/qstash/triggers";
import { QstashScheduleSetupError } from "@notra/ai/schemas/qstash";
import { logError } from "@notra/ai/utils/server-log";
import {
  hashTrigger,
  normalizeTriggerConfig,
  scheduleDedupeHashes,
} from "@notra/ai/utils/trigger-hash";
import { db } from "@notra/db/drizzle";
import {
  contentTriggerLookbackWindows,
  contentTriggers,
  githubIntegrations,
  linearIntegrations,
} from "@notra/db/schema";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  type configureEventTriggerBodySchema,
  type configureScheduleBodySchema,
  type LookbackWindow,
  triggerTargetsSchema,
} from "@notra/schemas/dashboard/integrations";
import { and, eq, inArray, ne } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import type { z } from "zod";

import { DEFAULT_LOOKBACK_WINDOW } from "@/constants/workflows";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { AutomationServiceError } from "@/lib/automation/errors";
import {
  ManualTriggerRunError,
  triggerManualAutomationRun,
} from "@/lib/triggers/manual-run";
import type { AutomationActor } from "@/types/automation/service";
import type { Trigger } from "@/types/triggers/triggers";

type ScheduleBody = z.output<typeof configureScheduleBodySchema>;
type EventTriggerBody = z.output<typeof configureEventTriggerBodySchema>;
type TriggerRow = typeof contentTriggers.$inferSelect;

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);

function duplicateTriggerError() {
  return new AutomationServiceError(
    "DUPLICATE_TRIGGER",
    "An automation with the same settings already exists.",
    { data: { code: "DUPLICATE_TRIGGER" } }
  );
}

export async function findTriggerInOrganization(
  organizationId: string,
  triggerId: string
): Promise<TriggerRow> {
  const trigger = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.id, triggerId),
      eq(contentTriggers.organizationId, organizationId)
    ),
  });

  if (!trigger) {
    throw new AutomationServiceError("NOT_FOUND", "Schedule not found");
  }

  return trigger;
}

async function ensureScheduleTargetsExist(
  organizationId: string,
  repositoryIds: string[],
  linearIntegrationIds: string[] = []
) {
  if (repositoryIds.length === 0 && linearIntegrationIds.length === 0) {
    return;
  }

  const [targetIntegrations, targetLinearIntegrations] = await Promise.all([
    db.query.githubIntegrations.findMany({
      where: and(
        eq(githubIntegrations.organizationId, organizationId),
        inArray(githubIntegrations.id, repositoryIds)
      ),
      columns: { id: true },
    }),
    linearIntegrationIds.length === 0
      ? Promise.resolve([])
      : db.query.linearIntegrations.findMany({
          where: and(
            eq(linearIntegrations.organizationId, organizationId),
            eq(linearIntegrations.enabled, true),
            inArray(linearIntegrations.id, linearIntegrationIds)
          ),
          columns: { id: true },
        }),
  ]);

  const existingIds = new Set(
    targetIntegrations.map((integration) => integration.id)
  );
  const existingLinearIds = new Set(
    targetLinearIntegrations.map((integration) => integration.id)
  );
  const missingIds = [
    ...repositoryIds.filter((id) => !existingIds.has(id)),
    ...linearIntegrationIds.filter((id) => !existingLinearIds.has(id)),
  ];

  if (missingIds.length > 0) {
    throw new AutomationServiceError(
      "INTEGRATION_NOT_FOUND",
      `These integrations are not connected to this workspace: ${missingIds.join(", ")}`,
      {
        data: {
          code: "INTEGRATION_NOT_FOUND",
          missingIntegrationIds: missingIds,
        },
      }
    );
  }
}

async function createScheduleQstash(
  triggerId: string,
  cron: string,
  scheduleId?: string
) {
  try {
    return await createQstashSchedule({ triggerId, cron, scheduleId });
  } catch (error) {
    if (
      error instanceof QstashScheduleSetupError &&
      error.reason === "invalid_destination"
    ) {
      throw new AutomationServiceError(
        "INVALID_DESTINATION_URL",
        "Schedules cannot run because the app has no public URL configured.",
        { data: { code: "INVALID_DESTINATION_URL" } }
      );
    }
    throw error;
  }
}

function filterTriggersByRepositoryIds<TTrigger extends { targets: unknown }>(
  triggers: TTrigger[],
  repositoryIds?: string[]
) {
  const normalizedRepositoryIds = repositoryIds?.filter(Boolean);

  if (!normalizedRepositoryIds || normalizedRepositoryIds.length === 0) {
    return triggers;
  }

  const repositoryIdSet = new Set(normalizedRepositoryIds);

  return triggers.filter((trigger) => {
    const parsedTargets = triggerTargetsSchema.safeParse(trigger.targets);

    if (!parsedTargets.success) {
      return false;
    }

    return parsedTargets.data.repositoryIds.some((repositoryId) =>
      repositoryIdSet.has(repositoryId)
    );
  });
}

function serializeTrigger(
  trigger: Pick<
    TriggerRow,
    | "id"
    | "organizationId"
    | "name"
    | "sourceType"
    | "sourceConfig"
    | "targets"
    | "outputType"
    | "outputConfig"
    | "enabled"
    | "autoPublish"
    | "createdAt"
    | "updatedAt"
  > & { lookbackWindow?: LookbackWindow }
): Trigger {
  return {
    id: trigger.id,
    organizationId: trigger.organizationId,
    name: trigger.name,
    sourceType: trigger.sourceType as Trigger["sourceType"],
    sourceConfig: trigger.sourceConfig as Trigger["sourceConfig"],
    targets: trigger.targets as Trigger["targets"],
    outputType: trigger.outputType as Trigger["outputType"],
    outputConfig: trigger.outputConfig as Trigger["outputConfig"],
    enabled: trigger.enabled,
    autoPublish: trigger.autoPublish,
    createdAt: trigger.createdAt.toISOString(),
    updatedAt: trigger.updatedAt.toISOString(),
    ...(trigger.lookbackWindow
      ? { lookbackWindow: trigger.lookbackWindow }
      : {}),
  };
}

export async function deleteAutomationTrigger(
  actor: AutomationActor,
  triggerId: string
) {
  const existing = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.id, triggerId),
      eq(contentTriggers.organizationId, actor.organizationId)
    ),
  });

  if (!existing) {
    return { success: true };
  }

  if (existing.qstashScheduleId) {
    // A surviving schedule is harmless: the schedule workflow exits with
    // trigger_not_found once the row is gone.
    await deleteQstashSchedule(existing.qstashScheduleId).catch((error) => {
      logError("Error deleting schedule", error);
    });
  }

  await db
    .delete(contentTriggers)
    .where(
      and(
        eq(contentTriggers.id, triggerId),
        eq(contentTriggers.organizationId, actor.organizationId)
      )
    );

  trackServerEvent({
    event:
      existing.sourceType === "cron"
        ? POSTHOG_EVENTS.SCHEDULE_DELETED
        : POSTHOG_EVENTS.EVENT_TRIGGER_DELETED,
    headers: actor.headers,
    userId: actor.userId,
    organizationId: actor.organizationId,
    properties: {
      trigger_id: existing.id,
      output_type: existing.outputType,
      auto_publish: existing.autoPublish,
      enabled: existing.enabled,
    },
  });

  return { success: true };
}

export async function listEventTriggers(
  organizationId: string,
  repositoryIds?: string[]
) {
  const triggers = await db.query.contentTriggers.findMany({
    where: and(
      eq(contentTriggers.organizationId, organizationId),
      eq(contentTriggers.sourceType, "github_webhook")
    ),
    orderBy: (items, { desc }) => [desc(items.createdAt)],
  });

  return {
    triggers: filterTriggersByRepositoryIds(triggers, repositoryIds).map(
      serializeTrigger
    ),
  };
}

function eventTriggerDedupeHash(body: EventTriggerBody) {
  const normalized = normalizeTriggerConfig({
    sourceConfig: body.sourceConfig,
    targets: body.targets,
  });
  return {
    normalized,
    dedupeHash: hashTrigger({
      sourceType: body.sourceType,
      sourceConfig: normalized.sourceConfig,
      targets: normalized.targets,
      outputType: body.outputType,
    }),
  };
}

function assertEventTriggerSource(body: EventTriggerBody) {
  if (body.sourceType !== "github_webhook") {
    throw new AutomationServiceError(
      "EVENT_TRIGGERS_ONLY",
      "Only GitHub event triggers can be created here."
    );
  }
}

export async function createEventTrigger(
  actor: AutomationActor,
  body: EventTriggerBody
) {
  assertEventTriggerSource(body);
  const { normalized, dedupeHash } = eventTriggerDedupeHash(body);

  const existing = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.organizationId, actor.organizationId),
      eq(contentTriggers.dedupeHash, dedupeHash)
    ),
  });

  if (existing) {
    trackServerEvent({
      event: POSTHOG_EVENTS.EVENT_TRIGGER_DUPLICATE_REJECTED,
      headers: actor.headers,
      userId: actor.userId,
      organizationId: actor.organizationId,
      properties: {
        output_type: body.outputType,
        auto_publish: body.autoPublish,
        repo_count: normalized.targets.repositoryIds.length,
        existing_trigger_id: existing.id,
      },
    });
    throw duplicateTriggerError();
  }

  const [trigger] = await db
    .insert(contentTriggers)
    .values({
      id: nanoid(),
      organizationId: actor.organizationId,
      sourceType: body.sourceType,
      sourceConfig: normalized.sourceConfig,
      targets: normalized.targets,
      outputType: body.outputType,
      outputConfig: body.outputConfig ?? null,
      dedupeHash,
      enabled: body.enabled,
      autoPublish: body.autoPublish,
    })
    .returning();

  if (!trigger) {
    throw new AutomationServiceError("INTERNAL", "Failed to create trigger");
  }

  trackServerEvent({
    event: POSTHOG_EVENTS.EVENT_TRIGGER_CREATED,
    headers: actor.headers,
    userId: actor.userId,
    organizationId: actor.organizationId,
    properties: {
      trigger_id: trigger.id,
      output_type: body.outputType,
      auto_publish: body.autoPublish,
      enabled: body.enabled,
      repo_count: normalized.targets.repositoryIds.length,
    },
  });

  return { trigger: serializeTrigger(trigger) };
}

export async function updateEventTrigger(
  actor: AutomationActor,
  triggerId: string,
  body: EventTriggerBody
) {
  assertEventTriggerSource(body);
  const existing = await findTriggerInOrganization(
    actor.organizationId,
    triggerId
  );
  const { normalized, dedupeHash } = eventTriggerDedupeHash(body);

  const duplicate = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.organizationId, actor.organizationId),
      eq(contentTriggers.dedupeHash, dedupeHash),
      ne(contentTriggers.id, triggerId)
    ),
  });

  if (duplicate) {
    trackServerEvent({
      event: POSTHOG_EVENTS.EVENT_TRIGGER_DUPLICATE_REJECTED,
      headers: actor.headers,
      userId: actor.userId,
      organizationId: actor.organizationId,
      properties: {
        trigger_id: triggerId,
        output_type: body.outputType,
        auto_publish: body.autoPublish,
        repo_count: normalized.targets.repositoryIds.length,
        existing_trigger_id: duplicate.id,
      },
    });
    throw duplicateTriggerError();
  }

  const previousQstashScheduleId = existing.qstashScheduleId;

  const [trigger] = await db
    .update(contentTriggers)
    .set({
      sourceType: body.sourceType,
      sourceConfig: normalized.sourceConfig,
      targets: normalized.targets,
      outputType: body.outputType,
      outputConfig: body.outputConfig ?? null,
      dedupeHash,
      enabled: body.enabled,
      autoPublish: body.autoPublish,
      qstashScheduleId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(contentTriggers.id, triggerId),
        eq(contentTriggers.organizationId, actor.organizationId)
      )
    )
    .returning();

  if (previousQstashScheduleId) {
    await deleteQstashSchedule(previousQstashScheduleId).catch((error) => {
      logError("Error deleting schedule", error);
    });
  }

  if (!trigger) {
    throw new AutomationServiceError("INTERNAL", "Failed to update trigger");
  }

  if (existing.enabled !== body.enabled) {
    trackServerEvent({
      event: POSTHOG_EVENTS.EVENT_TRIGGER_TOGGLED,
      headers: actor.headers,
      userId: actor.userId,
      organizationId: actor.organizationId,
      properties: {
        trigger_id: trigger.id,
        enabled: body.enabled,
        output_type: body.outputType,
        auto_publish: body.autoPublish,
        repo_count: normalized.targets.repositoryIds.length,
      },
    });
  }

  return { trigger: serializeTrigger(trigger) };
}

export async function listScheduleTriggers(
  organizationId: string,
  repositoryIds?: string[]
) {
  const triggers = await db.query.contentTriggers.findMany({
    where: and(
      eq(contentTriggers.organizationId, organizationId),
      eq(contentTriggers.sourceType, "cron")
    ),
    orderBy: (items, { desc }) => [desc(items.createdAt)],
  });

  const filteredTriggers = filterTriggersByRepositoryIds(
    triggers,
    repositoryIds
  );
  const triggerIds = filteredTriggers.map((trigger) => trigger.id);
  const allRepositoryIds = [
    ...new Set(
      filteredTriggers.flatMap((trigger) => {
        const parsed = triggerTargetsSchema.safeParse(trigger.targets);
        return parsed.success ? parsed.data.repositoryIds : [];
      })
    ),
  ];

  const [lookbackWindows, repositories] = await Promise.all([
    triggerIds.length > 0
      ? db.query.contentTriggerLookbackWindows.findMany({
          columns: { triggerId: true, window: true },
          where: inArray(contentTriggerLookbackWindows.triggerId, triggerIds),
        })
      : [],
    allRepositoryIds.length > 0
      ? db
          .select({
            id: githubIntegrations.id,
            owner: githubIntegrations.owner,
            repo: githubIntegrations.repo,
            defaultBranch: githubIntegrations.defaultBranch,
          })
          .from(githubIntegrations)
          .where(
            and(
              eq(githubIntegrations.organizationId, organizationId),
              inArray(githubIntegrations.id, allRepositoryIds)
            )
          )
      : [],
  ]);

  const lookbackWindowByTriggerId = new Map(
    lookbackWindows.map((item) => [
      item.triggerId,
      item.window as LookbackWindow,
    ])
  );
  const triggersWithLookback = filteredTriggers.map((trigger) => ({
    ...trigger,
    lookbackWindow:
      lookbackWindowByTriggerId.get(trigger.id) ?? DEFAULT_LOOKBACK_WINDOW,
  }));

  const repositoryMap = Object.fromEntries(
    repositories
      .filter((repository) => repository.owner && repository.repo)
      .map((repository) => [
        repository.id,
        repository.defaultBranch?.trim()
          ? `${repository.owner}/${repository.repo} · ${repository.defaultBranch.trim()}`
          : `${repository.owner}/${repository.repo}`,
      ])
  );

  return {
    triggers: triggersWithLookback.map(serializeTrigger),
    repositoryMap,
  };
}

function scheduleHash(body: ScheduleBody) {
  const normalized = normalizeTriggerConfig({
    sourceConfig: body.sourceConfig,
    targets: body.targets,
  });
  return {
    normalized,
    dedupeHash: hashTrigger({
      sourceType: body.sourceType,
      sourceConfig: normalized.sourceConfig,
      targets: normalized.targets,
      outputType: body.outputType,
      lookbackWindow: body.lookbackWindow,
      instructions: body.outputConfig?.instructions,
      brandVoiceId: body.outputConfig?.brandVoiceId,
    }),
  };
}

export async function createScheduleTrigger(
  actor: AutomationActor,
  body: ScheduleBody,
  untitledName: string
) {
  const { normalized, dedupeHash } = scheduleHash(body);

  const existing = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.organizationId, actor.organizationId),
      inArray(contentTriggers.dedupeHash, scheduleDedupeHashes(body))
    ),
  });

  if (existing) {
    trackServerEvent({
      event: POSTHOG_EVENTS.EVENT_TRIGGER_DUPLICATE_REJECTED,
      headers: actor.headers,
      userId: actor.userId,
      organizationId: actor.organizationId,
      properties: {
        source_type: body.sourceType,
        output_type: body.outputType,
        auto_publish: body.autoPublish,
        frequency: body.sourceConfig.cron.frequency,
        repo_count: normalized.targets.repositoryIds.length,
        existing_trigger_id: existing.id,
      },
    });
    throw duplicateTriggerError();
  }

  if (body.enabled === true) {
    await ensureScheduleTargetsExist(
      actor.organizationId,
      normalized.targets.repositoryIds,
      normalized.targets.linearIntegrationIds
    );
  }

  const triggerId = nanoid();
  const cronExpression = buildCronExpression(body.sourceConfig.cron);
  const persistedName = body.name.trim() || untitledName;
  const qstashScheduleId = cronExpression
    ? await createScheduleQstash(triggerId, cronExpression)
    : null;

  try {
    const trigger = await db.transaction(async (tx) => {
      const [createdTrigger] = await tx
        .insert(contentTriggers)
        .values({
          id: triggerId,
          organizationId: actor.organizationId,
          name: persistedName,
          sourceType: body.sourceType,
          sourceConfig: normalized.sourceConfig,
          targets: normalized.targets,
          outputType: body.outputType,
          outputConfig: body.outputConfig ?? null,
          dedupeHash,
          enabled: body.enabled,
          autoPublish: body.autoPublish,
          qstashScheduleId,
        })
        .returning();

      if (!createdTrigger) {
        throw new Error("Failed to create schedule");
      }

      await tx.insert(contentTriggerLookbackWindows).values({
        triggerId,
        window: body.lookbackWindow,
      });

      return { ...createdTrigger, lookbackWindow: body.lookbackWindow };
    });

    trackServerEvent({
      event: POSTHOG_EVENTS.SCHEDULE_CREATED,
      headers: actor.headers,
      userId: actor.userId,
      organizationId: actor.organizationId,
      properties: {
        trigger_id: trigger.id,
        output_type: body.outputType,
        frequency: body.sourceConfig.cron.frequency,
        auto_publish: body.autoPublish,
        enabled: body.enabled,
        lookback_window: body.lookbackWindow,
        repo_count: normalized.targets.repositoryIds.length,
      },
    });

    return { trigger: serializeTrigger(trigger) };
  } catch (error) {
    if (qstashScheduleId) {
      await deleteQstashSchedule(qstashScheduleId).catch((cleanupError) => {
        logError("Error deleting schedule", cleanupError);
      });
    }

    await db
      .delete(contentTriggers)
      .where(
        and(
          eq(contentTriggers.id, triggerId),
          eq(contentTriggers.organizationId, actor.organizationId)
        )
      )
      .catch((cleanupError) => {
        logError("Error deleting trigger", cleanupError);
      });

    throw new AutomationServiceError("INTERNAL", "Internal server error", {
      cause: error,
    });
  }
}

export async function updateScheduleTrigger(
  actor: AutomationActor,
  triggerId: string,
  body: ScheduleBody,
  untitledName: string
) {
  const { normalized, dedupeHash } = scheduleHash(body);

  const duplicate = await db.query.contentTriggers.findFirst({
    where: and(
      eq(contentTriggers.organizationId, actor.organizationId),
      inArray(contentTriggers.dedupeHash, scheduleDedupeHashes(body)),
      ne(contentTriggers.id, triggerId)
    ),
  });

  if (duplicate) {
    trackServerEvent({
      event: POSTHOG_EVENTS.EVENT_TRIGGER_DUPLICATE_REJECTED,
      headers: actor.headers,
      userId: actor.userId,
      organizationId: actor.organizationId,
      properties: {
        trigger_id: triggerId,
        source_type: body.sourceType,
        output_type: body.outputType,
        auto_publish: body.autoPublish,
        frequency: body.sourceConfig.cron.frequency,
        repo_count: normalized.targets.repositoryIds.length,
        existing_trigger_id: duplicate.id,
      },
    });
    throw duplicateTriggerError();
  }

  const existing = await findTriggerInOrganization(
    actor.organizationId,
    triggerId
  );

  if (body.enabled === true) {
    await ensureScheduleTargetsExist(
      actor.organizationId,
      normalized.targets.repositoryIds,
      normalized.targets.linearIntegrationIds
    );
  }

  const existingScheduleId = existing.qstashScheduleId;
  const cronExpression = buildCronExpression(body.sourceConfig.cron);
  const persistedName = body.name.trim() || existing.name || untitledName;
  const qstashScheduleId = cronExpression
    ? await createScheduleQstash(
        triggerId,
        cronExpression,
        existingScheduleId ?? undefined
      )
    : null;

  try {
    const trigger = await db.transaction(async (tx) => {
      const [updatedTrigger] = await tx
        .update(contentTriggers)
        .set({
          name: persistedName,
          sourceType: body.sourceType,
          sourceConfig: normalized.sourceConfig,
          targets: normalized.targets,
          outputType: body.outputType,
          outputConfig: body.outputConfig ?? null,
          dedupeHash,
          enabled: body.enabled,
          autoPublish: body.autoPublish,
          qstashScheduleId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(contentTriggers.id, triggerId),
            eq(contentTriggers.organizationId, actor.organizationId)
          )
        )
        .returning();

      if (!updatedTrigger) {
        throw new Error("Failed to update schedule");
      }

      await tx
        .insert(contentTriggerLookbackWindows)
        .values({ triggerId, window: body.lookbackWindow })
        .onConflictDoUpdate({
          target: contentTriggerLookbackWindows.triggerId,
          set: { window: body.lookbackWindow, updatedAt: new Date() },
        });

      return { ...updatedTrigger, lookbackWindow: body.lookbackWindow };
    });

    if (existing.enabled !== body.enabled) {
      trackServerEvent({
        event: POSTHOG_EVENTS.SCHEDULE_TOGGLED,
        headers: actor.headers,
        userId: actor.userId,
        organizationId: actor.organizationId,
        properties: {
          trigger_id: trigger.id,
          enabled: body.enabled,
          output_type: body.outputType,
          frequency: body.sourceConfig.cron.frequency,
          auto_publish: body.autoPublish,
        },
      });
    }

    return { trigger: serializeTrigger(trigger) };
  } catch (error) {
    if (qstashScheduleId && qstashScheduleId !== existingScheduleId) {
      await deleteQstashSchedule(qstashScheduleId).catch((cleanupError) => {
        logError("Error deleting schedule", cleanupError);
      });
    }

    throw new AutomationServiceError("INTERNAL", "Internal server error", {
      cause: error,
    });
  }
}

export async function runScheduleNow(
  actor: AutomationActor,
  triggerId: string
) {
  try {
    const { workflowRunId } = await triggerManualAutomationRun({
      organizationId: actor.organizationId,
      triggerId,
      triggeredBy: actor.userId,
    });

    trackServerEvent({
      event: POSTHOG_EVENTS.SCHEDULE_RUN_NOW,
      headers: actor.headers,
      userId: actor.userId,
      organizationId: actor.organizationId,
      properties: { trigger_id: triggerId, workflow_run_id: workflowRunId },
    });

    return {
      success: true,
      workflowRunId,
      message: "Schedule triggered successfully",
    };
  } catch (error) {
    if (error instanceof ManualTriggerRunError) {
      throw new AutomationServiceError("MANUAL_RUN", error.message, {
        data: { code: error.code },
      });
    }

    throw new AutomationServiceError("INTERNAL", "Failed to trigger schedule", {
      cause: error,
    });
  }
}
