import type { AnalyticsImportStatus } from "@notra/db/types/analytics-imports";

import {
  ANALYTICS_IMPORT_BUDGET_WAIT,
  ANALYTICS_IMPORT_STORAGE_WAIT,
} from "@/constants/analytics-imports";
import type {
  AnalyticsImportProgressPhase,
  AnalyticsImportWaitReason,
} from "@/types/analytics-imports";

export const ANALYTICS_IMPORT_PROGRESS_PHASES: Record<
  AnalyticsImportStatus,
  AnalyticsImportProgressPhase
> = {
  pending: "queued",
  running: "running",
  waiting_rate_limit: "waiting",
  completed: "completed",
  failed: "failed",
  deleting: "deleting",
  deleted: "deleted",
};

/** Phases after which nothing runs; the progress view offers a way back. */
export const ANALYTICS_IMPORT_ENDED_PHASES: ReadonlySet<AnalyticsImportProgressPhase> =
  new Set(["failed", "deleting", "deleted"]);

/** Phases whose imported rows are gone or going, so there is nothing to count. */
export const ANALYTICS_IMPORT_REMOVED_PHASES: ReadonlySet<AnalyticsImportProgressPhase> =
  new Set(["deleting", "deleted"]);

/** Dialog title per phase, under `geo.analyticsImport.progress`. */
export const ANALYTICS_IMPORT_PROGRESS_TITLES = {
  queued: "title",
  running: "title",
  waiting: "title",
  completed: "titleDone",
  failed: "titleFailed",
  deleting: "titleDeleting",
  deleted: "titleDeleted",
} as const satisfies Record<AnalyticsImportProgressPhase, string>;

/**
 * A waiting import's `lastError` names what it waits for when that is Notra
 * (its request budget or its storage), not the provider.
 */
export const ANALYTICS_IMPORT_WAIT_REASONS: Readonly<
  Record<string, AnalyticsImportWaitReason>
> = {
  [ANALYTICS_IMPORT_BUDGET_WAIT]: "waitingBudget",
  [ANALYTICS_IMPORT_STORAGE_WAIT]: "waitingStorage",
};
