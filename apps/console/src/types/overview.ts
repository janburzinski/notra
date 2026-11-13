import type { ReactNode } from "react";

/** A count in the selected window and in the same-length window before it. */
export interface OverviewPeriodCount {
  current: number;
  previous: number;
}

export interface OverviewGrowth {
  signups: OverviewPeriodCount;
  workspaces: OverviewPeriodCount;
  /** Of the workspaces created in the window, how many finished onboarding. */
  onboarded: number;
  /** Workspaces that wrote content, ran a scan, chatted or ran Autopilot. */
  activeWorkspaces: OverviewPeriodCount;
  totalUsers: number;
  totalWorkspaces: number;
}

export interface OverviewContent {
  written: OverviewPeriodCount;
  published: OverviewPeriodCount;
  chats: OverviewPeriodCount;
  automationRuns: OverviewPeriodCount;
  automationFailed: number;
}

export interface OverviewGeo {
  scans: OverviewPeriodCount;
  scansFailed: number;
  checks: number;
  costUsd: number;
  medianDurationMs: number | null;
  readinessReports: OverviewPeriodCount;
  freeScansClaimed: OverviewPeriodCount;
}

export interface OverviewPlatform {
  autopilotRuns: OverviewPeriodCount;
  autopilotFailed: number;
  workflowRuns: OverviewPeriodCount;
  workflowFailed: number;
  sitesCreated: OverviewPeriodCount;
  deployments: OverviewPeriodCount;
  deploymentsFailed: number;
  feedback: OverviewPeriodCount;
  slackRequests: OverviewPeriodCount;
}

export interface OverviewActivityDay {
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  signups: number;
  workspaces: number;
  content: number;
  scans: number;
  chats: number;
}

export interface OverviewContentType {
  contentType: string;
  /** Created in the window. */
  written: number;
  /** Published in the window, whenever they were created. */
  published: number;
}

export interface OverviewSignupSource {
  source: string;
  workspaces: number;
}

export interface OverviewWorkspace {
  organizationId: string;
  name: string;
  slug: string;
  content: number;
  scans: number;
  chats: number;
  autopilotRuns: number;
  total: number;
}

export interface OverviewInsights {
  days: number;
  growth: OverviewGrowth;
  content: OverviewContent;
  geo: OverviewGeo;
  platform: OverviewPlatform;
  activity: OverviewActivityDay[];
  contentTypes: OverviewContentType[];
  signupSources: OverviewSignupSource[];
  workspaces: OverviewWorkspace[];
}

export interface OverviewSectionProps {
  insights: OverviewInsights | undefined;
}

export interface OverviewMetricCardProps {
  label: string;
  count: OverviewPeriodCount;
  hint?: string;
  warning?: boolean;
}

interface OverviewBreakdownColumn<Row> {
  label: string;
  /** Right-aligned and formatted as a number. */
  numeric?: boolean;
  value: (row: Row) => ReactNode;
}

export interface OverviewBreakdownTableProps<Row> {
  title: string;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  columns: OverviewBreakdownColumn<Row>[];
}
