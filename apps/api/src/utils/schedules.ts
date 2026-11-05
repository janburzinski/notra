import { normalizeCronConfig } from "@notra/ai/qstash/triggers";
import { scheduleDedupeHashes } from "@notra/ai/utils/trigger-hash";
import type { QstashError } from "@notra/schemas/api/qstash";
import {
  createScheduleRequestSchema,
  scheduleOutputConfigSchema,
  scheduleSourceConfigSchema,
  scheduleTargetsRepositoryIdsSchema,
  storedScheduleTargetsSchema,
} from "@notra/schemas/api/schedules";
import { Effect } from "effect";
import * as z from "zod";

import type { ScheduleDatabaseError } from "../errors/schedules";
import type {
  CreateScheduleBody,
  PatchScheduleBody,
  ScheduleDomainError,
  ScheduleTriggerRow,
  ScheduleTriggerWithLookbackWindow,
} from "../types/schedules";
import { logError } from "./logging";

export const DEFAULT_SCHEDULE_NAME = "Untitled Schedule";

export function runScheduleProgram<A, E extends ScheduleDomainError>(
  program: Effect.Effect<A, E | ScheduleDatabaseError>
) {
  return Effect.runPromise(
    Effect.result(
      program.pipe(
        Effect.catchTag("ScheduleDatabaseError", (failure) =>
          Effect.die(failure.cause)
        )
      )
    )
  );
}

export function normalizeSchedule(input: CreateScheduleBody) {
  return {
    ...input,
    sourceConfig: {
      cron:
        normalizeCronConfig(input.sourceConfig.cron) ?? input.sourceConfig.cron,
    },
    targets: {
      repositoryIds: [...input.targets.repositoryIds].sort(),
      ...(input.targets.linearIntegrationIds === undefined
        ? {}
        : {
            linearIntegrationIds: [
              ...input.targets.linearIntegrationIds,
            ].sort(),
          }),
    },
  };
}

export function hashSchedule(input: CreateScheduleBody) {
  return scheduleDedupeHashes(input)[0];
}

export function serializeSchedule(trigger: ScheduleTriggerWithLookbackWindow) {
  return {
    id: trigger.id,
    organizationId: trigger.organizationId,
    name: trigger.name,
    sourceType: "cron" as const,
    sourceConfig: scheduleSourceConfigSchema.parse(trigger.sourceConfig),
    targets: storedScheduleTargetsSchema.parse(trigger.targets),
    outputType: createScheduleRequestSchema.shape.outputType.parse(
      trigger.outputType
    ),
    outputConfig:
      trigger.outputConfig == null
        ? null
        : scheduleOutputConfigSchema.parse(trigger.outputConfig),
    enabled: trigger.enabled,
    autoPublish: trigger.autoPublish,
    createdAt: trigger.createdAt.toISOString(),
    updatedAt: trigger.updatedAt.toISOString(),
    lookbackWindow: trigger.lookbackWindow,
  };
}

export function safeSerializeSchedule(
  trigger: Parameters<typeof serializeSchedule>[0]
) {
  try {
    return serializeSchedule(trigger);
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      throw error;
    }

    logError(`Skipping malformed schedule ${trigger.id}`, error);
    return null;
  }
}

type ScheduleBodyDraft = Partial<
  Omit<CreateScheduleBody, "targets" | "outputConfig">
> & {
  targets?: Partial<CreateScheduleBody["targets"]>;
  outputConfig?: Record<string, unknown>;
};

/**
 * Applies a PATCH body on top of the stored schedule. Top-level fields replace
 * the stored value, targets and outputConfig merge per field, and null clears
 * an outputConfig field. The result is validated like a create request.
 */
export function mergeSchedulePatch(
  existing: ScheduleBodyDraft | null,
  patch: PatchScheduleBody
) {
  const base = existing ?? {};
  const { targets, outputConfig, ...fields } = patch;
  const definedFields = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );

  const mergedTargets =
    targets === undefined
      ? base.targets
      : {
          ...base.targets,
          ...Object.fromEntries(
            Object.entries(targets).filter(([, value]) => value !== undefined)
          ),
        };

  let mergedOutputConfig = base.outputConfig;
  if (outputConfig === null) {
    mergedOutputConfig = undefined;
  } else if (outputConfig !== undefined) {
    mergedOutputConfig = Object.fromEntries(
      Object.entries({ ...base.outputConfig, ...outputConfig }).filter(
        ([, value]) => value !== null && value !== undefined
      )
    );
  }

  return createScheduleRequestSchema.safeParse({
    ...base,
    ...definedFields,
    targets: mergedTargets,
    outputConfig: mergedOutputConfig,
  });
}

/** Returns null when the stored row no longer matches the API contract. */
export function scheduleBodyFromTrigger(
  trigger: ScheduleTriggerWithLookbackWindow
): ScheduleBodyDraft | null {
  let serialized: ReturnType<typeof serializeSchedule>;
  try {
    serialized = serializeSchedule(trigger);
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      throw error;
    }
    return null;
  }
  const { id, organizationId, createdAt, updatedAt, outputConfig, ...body } =
    serialized;
  return { ...body, outputConfig: outputConfig ?? undefined };
}

export function mapQstashError(error: QstashError) {
  if (error.kind === "destination") {
    return { error: "External URL not configured", status: 400 as const };
  }

  return { error: "Failed to configure schedule", status: 500 as const };
}

export function filterSchedulesByRepositoryIds(
  triggers: ScheduleTriggerRow[],
  repositoryIds: string[]
) {
  if (repositoryIds.length === 0) {
    return triggers;
  }

  const repositoryIdSet = new Set(repositoryIds);

  return triggers.filter((trigger) => {
    const parsed = scheduleTargetsRepositoryIdsSchema.safeParse(
      trigger.targets
    );

    if (!parsed.success) {
      return false;
    }

    return parsed.data.repositoryIds.some((repositoryId) =>
      repositoryIdSet.has(repositoryId)
    );
  });
}
