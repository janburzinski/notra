import type {
  autopilotAdminRequestSchema,
  autopilotAdminRunSchema,
  autopilotAdminTraceResponseSchema,
} from "@notra/schemas/api/autopilot-admin";
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
