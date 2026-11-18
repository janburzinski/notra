export type GeoScanEventStep =
  | "prepare"
  | "task_batch"
  | "sequence_batch"
  | "persona_batch"
  | "finalize"
  | "retry";

export interface GeoScanRoleUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalUsd: number;
}

export interface GeoScanUsageByRole {
  engine: GeoScanRoleUsage;
  judge: GeoScanRoleUsage;
}

export interface GeoScanPlanSnapshot {
  tasks?: GeoScanPlannedAnswer[];
  taskStates?: Record<string, "running" | "failed">;
  totalChecks: number;
  promptCount: number;
  sequenceCount: number;
  engines: string[];
  languages: string[];
}

export interface GeoScanPlanEngineSummary {
  readonly engine: string;
  readonly plannedChecks: number;
  readonly failedChecks: number;
}

export interface GeoScanPlanSummary {
  readonly plannedChecks: number;
  readonly hasTasks: boolean;
  readonly engines: string[];
  readonly taskCounts: GeoScanPlanEngineSummary[];
}

export interface GeoScanPlannedAnswer {
  personaId?: string;
  sequenceId?: string;
  turn?: number;
  key: string;
  promptId: string;
  prompt: string;
  engine: string;
  language: string;
}
