import type { createDb } from "@notra/db/drizzle";
import type { contentTriggers, lookbackWindowEnum } from "@notra/db/schema";
import type {
  createScheduleRequestSchema,
  patchScheduleRequestSchema,
} from "@notra/schemas/api/schedules";
import type { z } from "zod";

import type {
  ScheduleDisabledError,
  ScheduleDuplicateError,
  ScheduleInvalidUpdateError,
  ScheduleMissingTargetsError,
  ScheduleNotFoundError,
  ScheduleQstashError,
  ScheduleRunStartError,
} from "../errors/schedules";
import type { QstashEnv } from "./qstash";

type ScheduleLookbackWindow = (typeof lookbackWindowEnum.enumValues)[number];

export type ScheduleTriggerRow = typeof contentTriggers.$inferSelect;

export type ScheduleTriggerWithLookbackWindow = ScheduleTriggerRow & {
  lookbackWindow: ScheduleLookbackWindow;
};

export type ScheduleDomainError =
  | ScheduleNotFoundError
  | ScheduleDuplicateError
  | ScheduleInvalidUpdateError
  | ScheduleMissingTargetsError
  | ScheduleQstashError
  | ScheduleDisabledError
  | ScheduleRunStartError;

interface ScheduleProgramInput {
  db: ReturnType<typeof createDb>;
  organizationId: string;
}

export interface ListSchedulesProgramInput extends ScheduleProgramInput {
  repositoryIds: string[];
}

export interface PatchScheduleProgramInput extends ScheduleProgramInput {
  scheduleId: string;
  body: PatchScheduleBody;
  env: QstashEnv;
}

export interface CreateScheduleProgramInput extends ScheduleProgramInput {
  body: z.infer<typeof createScheduleRequestSchema>;
  env: QstashEnv;
}

export interface RunScheduleProgramInput extends ScheduleProgramInput {
  scheduleId: string;
  actorId: string;
  env: { WORKFLOW_BASE_URL?: string };
}

export interface ScheduleRunsProgramInput extends ScheduleProgramInput {
  scheduleId: string;
  limit: number;
}

export interface DeleteScheduleProgramInput extends ScheduleProgramInput {
  scheduleId: string;
  env: QstashEnv;
}

export type CreateScheduleBody = z.infer<typeof createScheduleRequestSchema>;

export type PatchScheduleBody = z.infer<typeof patchScheduleRequestSchema>;
