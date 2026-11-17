import type { AutopilotJobKind } from "@notra/db/types/autopilot";
import type {
  autopilotAdminRequestSchema,
  autopilotAdminRunSchema,
  autopilotAdminTraceResponseSchema,
} from "@notra/schemas/api/autopilot-admin";
import type { ReactNode } from "react";
import type * as z from "zod";

export type AutopilotAdminRequest = z.infer<typeof autopilotAdminRequestSchema>;
export type AutopilotAdminRun = z.infer<typeof autopilotAdminRunSchema>;
type AutopilotAdminTrace = z.infer<typeof autopilotAdminTraceResponseSchema>;
export interface AutopilotPageProps {
  slug: string;
}
export interface AutopilotTracePageProps extends AutopilotPageProps {
  runId: string;
}
export interface AutopilotRouteProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}
export interface AutopilotTraceRouteProps {
  params: Promise<{ slug: string; runId: string }>;
}
export interface AutopilotPageCursor {
  before: string;
  beforeId: string;
}
export type AutopilotStatusFilter = AutopilotAdminRun["status"] | "all";

export interface AutopilotTraceEventsProps {
  events: AutopilotAdminTrace["events"];
  includeDetail: boolean;
}

export interface AutopilotTraceFindingsProps {
  findings: AutopilotAdminTrace["findings"];
}

export interface AutopilotTraceSummaryProps {
  trace: AutopilotAdminTrace;
}

export type AutopilotTraceEvent = AutopilotAdminTrace["events"][number];

/** model: one structured call; agent: a tool loop, its steps drawn below it. */
type AutopilotSpanKind = "model" | "agent" | "step";

/** One recorded field of an event, formatted for a tooltip row. */
export interface AutopilotEventDetail {
  label: string;
  value: string;
}

export interface AutopilotSpan {
  id: string;
  eventId: string;
  lane: string;
  kind: AutopilotSpanKind;
  label: string;
  model: string | null;
  startMs: number;
  endMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  reasoningTokens: number | null;
  /** Steps an agent loop took; null for single calls and steps. */
  steps: number | null;
  tools: string[] | null;
  finishReason: string | null;
  /** For a step: how many steps its agent loop took. */
  loopSteps: number | null;
  /** Fields the event recorded beyond model, timing and tokens. */
  details: AutopilotEventDetail[];
}

export interface AutopilotMark {
  eventId: string;
  lane: string;
  atMs: number;
  level: AutopilotTraceEvent["level"];
  label: string;
  /** Tool calls and progress notes; drawn quieter than decisions. */
  minor: boolean;
  details: AutopilotEventDetail[];
}

export interface AutopilotUsageTotals {
  calls: number;
  steps: number;
  /** Null when no step recorded its tools (runs before step telemetry). */
  toolCalls: number | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  modelTimeMs: number;
}

export interface AutopilotLaneTelemetry extends AutopilotUsageTotals {
  lane: string;
  startMs: number;
  endMs: number;
  errors: number;
  pullRequests: number;
}

export interface AutopilotModelTelemetry extends AutopilotUsageTotals {
  model: string;
}

export interface AutopilotTelemetry {
  originMs: number;
  endMs: number;
  totals: AutopilotUsageTotals & { errors: number; retries: number };
  lanes: AutopilotLaneTelemetry[];
  models: AutopilotModelTelemetry[];
  spans: AutopilotSpan[];
  marks: AutopilotMark[];
}

export interface AutopilotTraceTelemetryProps {
  telemetry: AutopilotTelemetry;
  truncated: boolean;
}

/** A count in the selected window and in the same-length window before it. */
interface AutopilotHealthPeriod {
  current: number;
  previous: number;
}

export interface AutopilotHealthTotals {
  runs: AutopilotHealthPeriod;
  failed: AutopilotHealthPeriod;
  stopped: number;
  /** Running right now, whatever the window. */
  running: number;
  medianDurationMs: number | null;
  p90DurationMs: number | null;
  /** Workspaces with Autopilot switched on now. */
  enabledWorkspaces: number;
  /** Workspaces that had a run in the window. */
  activeWorkspaces: number;
  /** Pull requests opened in the window. */
  drafts: AutopilotHealthPeriod;
  merged: AutopilotHealthPeriod;
  /** Pull requests closed by a person or auto-closed as stale in the window. */
  closed: number;
  /** Drafts waiting for a person right now. */
  inReview: number;
  credits: number;
}

/** Runs started in one hour (24-hour range) or one UTC day. */
export interface AutopilotHealthBucket {
  at: string;
  completed: number;
  failed: number;
  stopped: number;
}

/** One built-in template (job), from its ideas to merged drafts. */
export interface AutopilotHealthTemplate {
  kind: AutopilotJobKind;
  enabledWorkspaces: number;
  /** Runs where the job did more than skip. */
  runs: number;
  /** Runs where the job logged at least one error. */
  failedRuns: number;
  errors: number;
  ideas: number;
  drafts: number;
  merged: number;
  dismissed: number;
  expired: number;
  failedFindings: number;
  inReview: number;
  credits: number;
}

/** Errors with the same wording once ids and numbers are blanked out. */
export interface AutopilotHealthFailure {
  job: AutopilotJobKind | null;
  message: string;
  occurrences: number;
  runs: number;
  workspaces: number;
  lastSeenAt: string;
  exampleRunId: string;
  exampleOrganizationSlug: string;
}

export interface AutopilotHealthWorkspace {
  organizationId: string;
  slug: string;
  name: string;
  enabled: boolean;
  repository: string | null;
  slack: boolean;
  jobsOn: number;
  runs: number;
  failed: number;
  lastRunId: string | null;
  lastRunStatus: AutopilotAdminRun["status"] | null;
  /** The last run is still running but stopped sending heartbeats. */
  lastRunStuck: boolean | null;
  lastRunAt: string | null;
  inReview: number;
  merged: number;
}

export interface AutopilotHealthWorkflow {
  id: string;
  name: string;
  organizationSlug: string;
  enabled: boolean;
  runs: number;
  failed: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

export interface AutopilotHealthWorkflows {
  total: number;
  enabled: number;
  runs: number;
  failed: number;
  top: AutopilotHealthWorkflow[];
}

export interface AutopilotHealthStuckRun {
  id: string;
  organizationSlug: string;
  startedAt: string;
  heartbeatAt: string;
}

export interface AutopilotHealth {
  days: number;
  generatedAt: string;
  totals: AutopilotHealthTotals;
  buckets: AutopilotHealthBucket[];
  templates: AutopilotHealthTemplate[];
  failures: AutopilotHealthFailure[];
  workspaces: AutopilotHealthWorkspace[];
  workflows: AutopilotHealthWorkflows;
  stuck: AutopilotHealthStuckRun[];
}

export interface AutopilotHealthViewProps {
  slug: string;
  health: AutopilotHealth;
}

export interface AutopilotHealthClientProps {
  slug: string;
  days: number;
}

export interface AutopilotHealthMetricProps {
  label: string;
  value: number;
  /** Change against the window before; omitted for counts that aren't periods. */
  change?: number | null;
  hint: string;
  warning?: boolean;
}

export interface AutopilotHealthNumberCellProps {
  value: number | string;
  note?: string | null;
  tone?: "destructive" | "warning";
}

export interface AutopilotHealthEmptyRowProps {
  columns: number;
  label: string;
}

export type AutopilotView = "health" | "runs";

export interface AutopilotAttentionItem {
  id: string;
  tone: "destructive" | "warning";
  title: string;
  detail: string;
  href: string | null;
}

export interface AutopilotPageClientProps extends AutopilotPageProps {
  view: AutopilotView;
}

export interface AutopilotHealthChartProps {
  buckets: AutopilotHealthBucket[];
  hourly: boolean;
}

export interface AutopilotHealthSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export interface AutopilotHealthColumn {
  label: string;
  numeric?: boolean;
}

export interface AutopilotHealthTableHeaderProps {
  columns: readonly AutopilotHealthColumn[];
}
