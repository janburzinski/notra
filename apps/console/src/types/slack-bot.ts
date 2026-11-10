import type { ReactNode } from "react";

export interface SlackBotSummary {
  /** Messages the bot picked up, excluding blocked mentions. */
  requests: number;
  mentions: number;
  directMessages: number;
  threadReplies: number;
  /** Mentions in channels the workspace has not enabled. */
  blocked: number;
  completed: number;
  failed: number;
  cancelled: number;
  unanswered: number;
  users: number;
  workspaces: number;
  medianResponseMs: number | null;
  p90ResponseMs: number | null;
  averageResponseMs: number | null;
}

export interface SlackBotThreadStats {
  threads: number;
  averageTurns: number | null;
  maxTurns: number;
  /** Threads where someone followed up after the first answer. */
  multiTurnThreads: number;
}

export interface SlackBotActivityDay {
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  completed: number;
  failed: number;
  other: number;
  medianResponseSeconds: number | null;
}

export interface SlackBotToolUsage {
  tool: string;
  calls: number;
}

export interface SlackBotWorkspace {
  organizationId: string;
  name: string;
  slug: string;
  requests: number;
  users: number;
  failed: number;
  medianResponseMs: number | null;
}

export interface SlackBotInsights {
  days: number;
  summary: SlackBotSummary;
  threads: SlackBotThreadStats;
  activity: SlackBotActivityDay[];
  tools: SlackBotToolUsage[];
  workspaces: SlackBotWorkspace[];
}

export interface SlackBotChartsProps {
  insights: SlackBotInsights | undefined;
}

export interface SlackBotBreakdownProps {
  insights: SlackBotInsights;
}

export interface SlackBotTableCardProps {
  title: string;
  empty: boolean;
  children: ReactNode;
}
