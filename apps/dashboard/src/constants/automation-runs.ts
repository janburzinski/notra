import { Loading03Icon } from "@hugeicons/core-free-icons";
import type { AutomationRunStatus } from "@notra/schemas/dashboard/automation/runs";
import type { StatusBadgeAppearance } from "@notra/ui/types/status-badge";

/** A run still `running` after this long stopped without reporting back. */
export const AUTOMATION_RUN_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
export const AUTOMATION_RUN_STALE_MESSAGE =
  "The run stopped without reporting a result";
export const AUTOMATION_RUNS_POLL_INTERVAL_MS = 5000;

export const AUTOMATION_RUN_STATUS_BADGES: Record<
  AutomationRunStatus,
  StatusBadgeAppearance
> = {
  running: { variant: "info", icon: Loading03Icon, spin: true },
  success: { variant: "success" },
  failed: { variant: "destructive" },
  skipped: { variant: "secondary" },
};
