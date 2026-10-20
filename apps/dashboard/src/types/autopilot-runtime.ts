import type { createOctokit } from "@notra/ai/utils/octokit";
import type { autopilotFindings, autopilotRuns } from "@notra/db/schema";
import type {
  AutopilotEventLevel,
  AutopilotFindingEvidence,
  AutopilotImpactTarget,
  AutopilotRunEventData,
  AutopilotTraceDetail,
} from "@notra/db/types/autopilot";
import type { AgentReadinessReportView } from "@notra/geo-core/types/agent-readiness";
import type * as z from "zod";

import type {
  blogFileSchema,
  readinessAgentOutputSchema,
} from "@/schemas/autopilot";
import type { MergedPullRequest } from "@/types/autopilot";

export type AutopilotOctokit = ReturnType<typeof createOctokit>;
export type AutopilotFindingRow = typeof autopilotFindings.$inferSelect;
export interface AutopilotPullRequestRef {
  owner: string;
  repo: string;
  pullNumber: number;
}
export type AutopilotReadinessReport = AgentReadinessReportView & {
  score: number;
};
export type AutopilotRunTrigger =
  (typeof autopilotRuns.$inferInsert)["trigger"];
export type BlogFile = z.infer<typeof blogFileSchema>;
export type ReadinessAgentOutput = z.infer<typeof readinessAgentOutputSchema>;
export type AutopilotPullRequestMoment = "ready" | "merged" | "closed";

export interface AutopilotAdminRunFilters {
  organizationId?: string;
  status?: (typeof autopilotRuns.$inferSelect)["status"];
  limit?: number;
  before?: string;
  beforeId?: string;
}

export interface AutopilotPullRequestAuthor {
  headRef: string;
  authorType: string | null;
}

export type AutopilotPullRequestSummary = Pick<
  MergedPullRequest,
  "number" | "title" | "url"
> & { body: string | null };

/** A held finding: only the token holder may write it or move it on. */
export interface FindingClaim {
  finding: AutopilotFindingRow;
  token: string;
}

export type AutopilotPostBrief = NonNullable<AutopilotFindingEvidence["brief"]>;

export interface AutopilotSchedule {
  briefHour: number;
  timezone: string;
  lastRunAt: Date | null;
}

export interface AutopilotStagedFile {
  path: string;
  content: string;
  issueIds: string[];
  reason: string;
}

export type AutopilotLogFn = (
  message: string,
  data?: AutopilotRunEventData,
  /** Admin-only: prompts, model inputs and outputs. Never shown to users. */
  detail?: AutopilotTraceDetail
) => Promise<void>;

export type AutopilotLogger = Record<AutopilotEventLevel, AutopilotLogFn> & {
  /** Admin-only step, e.g. why one candidate was dropped. Hidden from users. */
  trace: (message: string, detail?: AutopilotTraceDetail) => Promise<void>;
};

/** A content gap the keywords job may turn into a post or a page update. */
export interface AutopilotKeywordCandidate {
  key: string;
  topic: string;
  competitors: string[];
  evidence: string;
  target: AutopilotImpactTarget;
  updatePage: { url: string; title: string } | null;
}

/**
 * Before and after for one pull request. mentions: share of AI answers naming
 * the brand (0 to 1); position: Search Console position (lower is better);
 * score: agent readiness score. after is null until there is data after the merge.
 */
export interface AutopilotImpact {
  metric: "mentions" | "position" | "score";
  before: number | null;
  after: number | null;
}
