import type {
  AUTOPILOT_RUN_TRIGGERS,
  AUTOPILOT_AUTOMATION_KINDS,
} from "@notra/db/constants/autopilot";
import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import type { autopilotMetricsDaysSchema } from "@notra/schemas/dashboard/autopilot";
import type * as z from "zod";

import type { AutopilotRunView } from "@/types/autopilot";
import type { AutopilotWorkflowSummary } from "@/types/autopilot-workflows";

export type AutopilotMetricsDays = z.infer<typeof autopilotMetricsDaysSchema>;

export type AutopilotRunTrigger = (typeof AUTOPILOT_RUN_TRIGGERS)[number];

export type AutopilotAutomationKind =
  (typeof AUTOPILOT_AUTOMATION_KINDS)[number];

/** A built-in automation, or a workflow the agent built for Autopilot. */
export type AutopilotAutomationRow =
  | {
      type: "builtin";
      id: string;
      kind: AutopilotAutomationKind;
      pullRequests: number | null;
      merged: number | null;
      /** One state per day of the last two weeks, oldest first. */
      history: AutopilotRunDay[] | null;
    }
  | { type: "workflow"; id: string; workflow: AutopilotWorkflowSummary };

interface AutopilotAutomationMetrics {
  kind: AutopilotAutomationKind;
  pullRequests: number;
  merged: number;
  /** Credits charged for this automation per run it took part in. */
  creditsPerRun: number;
}

/** What an automation did on one day: opened a pull request, failed, only ran, or didn't run. */
export type AutopilotRunDayState = "opened" | "failed" | "ran" | "idle";

export interface AutopilotRunDay {
  /** Calendar date in the workspace's time zone, "2026-11-16". */
  date: string;
  state: AutopilotRunDayState;
}

export interface AutopilotRunHistoryProps {
  days: AutopilotRunDay[];
}

export interface AutopilotMetrics {
  days: AutopilotMetricsDays;
  pullRequests: number;
  merged: number;
  averageCreditsPerRun: number;
  totalCredits: number;
  automations: AutopilotAutomationMetrics[];
}

export interface AutopilotAutomationsOverviewProps {
  organizationId: string;
  days: AutopilotMetricsDays;
  jobs: Record<AutopilotJobKind, boolean>;
  isRunning: boolean;
  canManage: boolean;
  /** The automation being turned on right now, if any. */
  onOpenAutomation: (kind: AutopilotAutomationKind) => void;
  onAddAutomation: (kind: AutopilotAutomationKind) => void;
  onRunAutomation: (kind: AutopilotAutomationKind) => void;
  onTurnOffAutomation: (kind: AutopilotAutomationKind) => void;
  onOpenWorkflow: (workflowId: string) => void;
  /** The automation being started right now, if any. */
  runningKind: AutopilotAutomationKind | null;
  runDisabled: boolean;
}

/** Right-click actions for a row of the Autopilot automations table. */
export interface AutopilotAutomationMenuItemsProps {
  row: AutopilotAutomationRow;
  canManage: boolean;
  /** Whether the row can't be started right now. */
  runDisabled: boolean;
  /** Whether its on/off state is being saved right now. */
  toggleBusy: boolean;
  onOpen: (row: AutopilotAutomationRow) => void;
  onRun: (row: AutopilotAutomationRow) => void;
  onTurnOff: (kind: AutopilotAutomationKind) => void;
  onSetWorkflowEnabled: (workflowId: string, enabled: boolean) => void;
  onDeleteWorkflow: (workflow: AutopilotWorkflowSummary) => void;
}

export interface AutopilotPeriodSelectProps {
  value: AutopilotMetricsDays;
  onChange: (days: AutopilotMetricsDays) => void;
}

/** Where the ideas found in the period ended up. */
export type AutopilotOutcomeKey =
  | "merged"
  | "inReview"
  | "suggested"
  | "dismissed"
  | "expired"
  | "failed";

export interface AutopilotAnalyticsSummary {
  /** Ideas (findings) Autopilot came up with. */
  ideas: number;
  /** Of those ideas, the ones that got a pull request. */
  ideasWithPullRequest: number;
  pullRequests: number;
  merged: number;
  /** Pull requests closed without a merge, by a person or as stale. */
  closed: number;
  /** merged / (merged + closed); null before anything was decided. */
  mergeRate: number | null;
  medianHoursToMerge: number | null;
  runs: number;
  /** completed / (completed + failed); running runs count for neither. */
  runSuccessRate: number | null;
  averageRunSeconds: number | null;
  credits: number;
}

interface AutopilotAnalyticsDay {
  /** YYYY-MM-DD, UTC. */
  day: string;
  opened: number;
  merged: number;
}

export interface AutopilotAnalyticsAutomation {
  kind: AutopilotAutomationKind;
  ideas: number;
  pullRequests: number;
  merged: number;
  mergeRate: number | null;
}

export interface AutopilotAnalytics {
  days: AutopilotMetricsDays;
  summary: AutopilotAnalyticsSummary;
  series: AutopilotAnalyticsDay[];
  outcomes: Record<AutopilotOutcomeKey, number>;
  triggers: { trigger: AutopilotRunTrigger; runs: number }[];
  automations: AutopilotAnalyticsAutomation[];
}

export interface AutopilotAnalyticsPanelProps {
  organizationId: string;
  days: AutopilotMetricsDays;
  /** The latest runs, whatever the period. */
  runs: AutopilotRunView[];
  onSelectRun: (run: AutopilotRunView) => void;
}

export interface AutopilotAutomationNumberProps {
  /** undefined for a workflow, which has no such number. */
  value: number | null | undefined;
}
