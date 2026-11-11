import type { AUTOPILOT_SCHEDULED_TRIGGERS } from "@notra/db/constants/autopilot";
import type { AutopilotFindingStatus } from "@notra/db/types/autopilot";

import type { AutopilotRunTrigger } from "@/types/autopilot-runtime";

/** Runs that handle one item next to the scheduled run. */
export const AUTOPILOT_ITEM_RUN_TRIGGERS = [
  "github",
  "suggestion",
] as const satisfies Exclude<
  AutopilotRunTrigger,
  (typeof AUTOPILOT_SCHEDULED_TRIGGERS)[number]
>[];

export const AUTOPILOT_FINDING_PULL_REQUEST_RESET = {
  repository: null,
  pullRequestNumber: null,
  pullRequestUrl: null,
  branch: null,
  headSha: null,
  openedAt: null,
} as const;

/** Statuses that block re-proposing the same fingerprint. */
export const AUTOPILOT_SETTLED_FINDING_STATUSES =
  new Set<AutopilotFindingStatus>(["suggested", "proposed", "merged"]);

export const AUTOPILOT_STALE_WRITER_MESSAGE =
  "The writer stopped before finishing";
