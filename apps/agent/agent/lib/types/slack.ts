import type { SLACK_AGENT_REQUEST_TRIGGERS } from "@notra/db/constants/slack-agent";

import type { VerifiedSessionAuth } from "./auth";

export interface ResolvedSlackInstallation {
  organizationId: string;
  organizationSlug: string | null;
  teamId: string;
  botToken: string;
  allowedChannelIds: string[] | null;
}

export interface InstallationCacheEntry {
  expiresAt: number;
  installation: ResolvedSlackInstallation | null;
}

export interface SlackDashboardRelay {
  channelId: string;
  threadTs: string;
  organizationId: string;
  message: string;
  auth: VerifiedSessionAuth;
}

export type SlackUsageCheck =
  | { allowed: true; attributes: Record<string, string> }
  | { allowed: false; message: string };

interface DraftCompletionState {
  count: number;
  turnId: string;
}

export interface PendingPostToX {
  organizationId: string;
  accountId: string;
  username: string;
  text: string;
  /** Slack user who asked for the tweet; unset when it came from elsewhere. */
  requestedBy?: string;
}

export interface PostToXOutcome {
  turnId: string;
  postUrl: string | null;
  failed: boolean;
  confirmed: boolean;
}

export interface SlackMessageRef {
  channelId: string;
  ts: string;
}

export type SlackRequestTrigger = (typeof SLACK_AGENT_REQUEST_TRIGGERS)[number];

export type SlackTurnOutcome = "completed" | "failed" | "cancelled";

export interface SlackTurnMetrics {
  turnId: string;
  messageTs: string | null;
  startedAt: number;
  firstResponseAt?: number;
  toolNames: string[];
}

export interface NotraSlackStateExtras {
  notraTurnMetrics?: SlackTurnMetrics;
  notraWorkingReactionKeys?: string[];
  notraChartFailureTurnId?: string;
  notraChartFailureIsPermission?: boolean;
  notraDraftCompletion?: DraftCompletionState;
  notraContentPullRequestTurnIds?: string[];
  notraReferenceCompletionTurnId?: string;
}
