import type {
  AUTOPILOT_EVENT_LEVELS,
  AUTOPILOT_FINDING_STATUSES,
  AUTOPILOT_JOB_KINDS,
  AUTOPILOT_RUN_STATUSES,
} from "../constants/autopilot";

export type AutopilotJobKind = (typeof AUTOPILOT_JOB_KINDS)[number];

export type AutopilotFindingStatus =
  (typeof AUTOPILOT_FINDING_STATUSES)[number];

export type AutopilotRunStatus = (typeof AUTOPILOT_RUN_STATUSES)[number];

export type AutopilotJobs = Record<AutopilotJobKind, boolean>;

export interface AutopilotFindingEvidence {
  sourceUrl?: string | null;
  score?: number | null;
  issueId?: string | null;
  /** Readiness issues this finding addresses; dismissing it stops retrying them. */
  issueIds?: string[];
  keyword?: string | null;
  competitors?: string[];
  pullRequests?: {
    number: number;
    title: string;
    url: string;
    /** GitHub login of who opened it; asked to review the draft. */
    author?: string | null;
  }[];
  detail?: string | null;
  /** Jev's confidence that this is worth a post, 0 to 1. */
  confidence?: number | null;
  /** Notra's comment offering the post; a thumbs down on it dismisses the finding. */
  offerComment?: { repository: string; id: number } | null;
  /** What the writer gets; stored so a suggestion can be written later. */
  brief?: { topic: string; angle: string; evidence: string } | null;
  /** What a merged pull request is measured on, with the value before it. */
  target?: AutopilotImpactTarget | null;
  /** An existing page the pull request rewrites instead of adding a post. */
  updatePage?: { url: string; title: string } | null;
  /** How Jev chose this over the other candidates of the same run. */
  decision?: AutopilotFindingDecision | null;
  /** Written by the daily run because nobody dismissed the idea in time. */
  autoWritten?: boolean;
  /** Failed writes so far; Autopilot gives up after a few. */
  failures?: number;
  /** Claim token holding an automatic draft slot; inert once the claim settles. */
  draftSlot?: string;
  /** States successfully announced in a Slack brief. */
  briefed?: ("suggested" | "proposed")[];
}

export interface AutopilotFindingDecision {
  /** Every candidate Jev compared with its odds, likeliest first. */
  considered: { title: string; share: number }[];
  /** The confidence a pull request needed without anyone asking. */
  threshold: number;
  /** Candidates the filters dropped before Jev saw them. */
  filteredOut: number;
}

/**
 * prompt: share of AI answers that name the brand (0 to 1). search: average
 * Search Console position. Readiness fixes use the report score instead.
 */
export type AutopilotImpactTarget =
  | { kind: "prompt"; promptId: string; before: number }
  | { kind: "search"; query: string; before: number | null };

export interface AutopilotRunSummary {
  findings: number;
  proposed: number;
  failed: number;
  /** Lines worth reading, shown on the Autopilot page and in the brief. */
  insights?: string[];
}

export type AutopilotEventLevel = (typeof AUTOPILOT_EVENT_LEVELS)[number];

export type AutopilotRunEventData = Record<
  string,
  string | number | boolean | null | string[] | Record<string, number>
>;

/** Raw material for the admin console; shape varies by event. */
export type AutopilotTraceDetail = Record<string, unknown>;
