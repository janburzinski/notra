import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import type { autopilotMetricsDaysSchema } from "@notra/schemas/dashboard/autopilot";
import type * as z from "zod";

import type { AUTOPILOT_AUTOMATION_KINDS } from "@/constants/autopilot";

export type AutopilotMetricsDays = z.infer<typeof autopilotMetricsDaysSchema>;

export type AutopilotAutomationKind =
  (typeof AUTOPILOT_AUTOMATION_KINDS)[number];

export interface AutopilotAutomationRow {
  kind: AutopilotAutomationKind;
  pullRequests: number | null;
  merged: number | null;
  creditsPerRun: number | null;
}

interface AutopilotAutomationMetrics {
  kind: AutopilotAutomationKind;
  pullRequests: number;
  merged: number;
  /** Credits charged for this automation per run it took part in. */
  creditsPerRun: number;
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
  addingKind: AutopilotAutomationKind | null;
  onOpenAutomation: (kind: AutopilotAutomationKind) => void;
  onAddAutomation: (kind: AutopilotAutomationKind) => void;
}

export interface AutopilotPeriodSelectProps {
  value: AutopilotMetricsDays;
  onChange: (days: AutopilotMetricsDays) => void;
}
