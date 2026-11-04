import type {
  McpAnalyticsResponse,
  McpToolDetailResponse,
  McpAnalyticsClient,
  McpAnalyticsElicitation,
  McpAnalyticsIntent,
  McpAnalyticsModel,
  McpAnalyticsRequest,
  McpAnalyticsSession,
  McpAnalyticsTool,
  McpAnalyticsUiRender,
  McpAnalyticsUser,
  McpAnalyticsVersion,
  McpSessionEvent,
  McpToolNeighbor,
} from "@notra/geo-core/types/mcp-analytics";
import type { ReactNode } from "react";

import type { MCP_LOG_FILTERS } from "@/constants/mcp-analytics";
import type { GeoRangeControl, GeoRangeQuery } from "@/types/geo";

export type McpToolStats = McpAnalyticsTool;

export type McpClientStats = McpAnalyticsClient;

export type McpModelStats = McpAnalyticsModel;

export type McpIntentStats = McpAnalyticsIntent;

export type McpUserStats = McpAnalyticsUser;

export type McpElicitationStats = McpAnalyticsElicitation;

export type McpUiRenderStats = McpAnalyticsUiRender;

export type McpSessionSummary = McpAnalyticsSession;

export type McpUnusedTool = NonNullable<
  McpAnalyticsResponse["catalog"]
>["unusedTools"][number];

export type McpRequestLogEntry = McpAnalyticsRequest;

export type McpLogFilter = (typeof MCP_LOG_FILTERS)[number];

export type McpRpcErrorKey =
  | "parse"
  | "invalidRequest"
  | "methodNotFound"
  | "invalidParams"
  | "internal"
  | "resourceNotFound";

export type McpServerRequestKey = "elicitation" | "sampling";

export type McpOutcomeBadgeVariant = "success" | "warning" | "secondary";

interface McpAnalyticsSectionsProps {
  data: McpAnalyticsResponse;
  onOpenTool: (name: string) => void;
  onOpenSession: (session: McpSessionSummary) => void;
  onOpenRequest: (entry: McpRequestLogEntry) => void;
}

export type McpToolSectionsProps = Pick<
  McpAnalyticsSectionsProps,
  "data" | "onOpenTool"
>;

export type McpAudienceSectionsProps = Omit<
  McpAnalyticsSectionsProps,
  "onOpenRequest"
>;

export type McpRequestLogProps = Pick<
  McpAnalyticsSectionsProps,
  "data" | "onOpenRequest"
>;

export interface McpTableEmptyProps {
  description: string;
}

export interface McpSheetHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

export interface McpPropertyRow {
  key: string;
  label: string;
  /** null hides the row, e.g. a session without a user. */
  value: string | null;
}

export interface McpPropertyTableProps {
  rows: McpPropertyRow[];
}

export interface McpNeighborRow {
  key: string;
  tool: string;
  calls: number;
  afterFailure: number;
  share: number;
}

export interface McpAnalyticsHeroProps {
  data: McpAnalyticsResponse;
  range: GeoRangeQuery;
}

export type McpChartMetric =
  | "toolCalls"
  | "sessions"
  | "errorRate"
  | "p95Latency";

export type McpTrendRow = { day: string; rawDay: string } & Record<
  string,
  number | string
>;

export interface McpAxisScale {
  max: number;
  interval: number;
  decimals: number;
}

export interface McpMetricCardProps {
  metric: McpMetric;
  data: Pick<McpAnalyticsResponse, "daily" | "hourly">;
  range: GeoRangeQuery;
}

export interface McpLoadFailedProps {
  onRetry: () => unknown;
}

export interface McpMetric {
  key: McpChartMetric;
  label: string;
  value: string;
  /** Percent change against the previous period; null hides the badge. */
  delta: number | null;
  lowerIsBetter?: boolean;
}

export interface McpAnalyticsPageProps {
  organizationSlug: string;
}

export interface McpRequestSheetProps {
  entry: McpRequestLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface McpRequestStatusBadgeProps {
  entry: Pick<McpSessionEvent, "status" | "errorCode"> &
    Partial<Pick<McpSessionEvent, "outcome">>;
}

export interface McpToolSheetProps {
  organizationId: string;
  range: GeoRangeQuery;
  tool: McpToolStats | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTool: (name: string) => void;
}

export interface McpSessionSheetProps {
  organizationId: string;
  range: GeoRangeQuery;
  session: McpSessionSummary | null;
  /** Baseline for the stat deltas; null hides them. */
  averages: McpSessionAverages | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface McpPayloadSnippetsProps {
  arguments: string;
  response: string;
}

export interface McpTrafficSkeletonProps {
  geoRange?: GeoRangeControl;
}

export interface McpVersionSelectProps {
  versions: readonly Pick<McpAnalyticsVersion, "version">[];
}

export interface McpNeighborTableProps {
  title: string;
  edgeLabel: string;
  neighbors: McpToolNeighbor[];
  loading: boolean;
  onSelectTool: (name: string) => void;
}

export interface McpSessionAverages {
  requests: number;
  toolCalls: number;
  durationSeconds: number;
}
