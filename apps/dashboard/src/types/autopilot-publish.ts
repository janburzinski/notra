import type { AUTOPILOT_HOLD_REASONS } from "@/constants/autopilot-publish";

export type AutopilotHoldReason =
  (typeof AUTOPILOT_HOLD_REASONS)[keyof typeof AUTOPILOT_HOLD_REASONS];

export interface AutopilotHoldInput {
  expectedHeadSha: string | null;
  expectedBaseRef: string | null;
  pullRequest: {
    state: string;
    merged: boolean;
    draft: boolean;
    headSha: string;
    baseRef: string;
    mergeable: boolean | null;
    mergeableState: string | null;
  };
  reviews: { state: string; bot: boolean }[];
  humanComments: number;
  truncated: boolean;
  checks: { status: string; conclusion: string | null }[] | null;
  /** Commit statuses (Vercel, Netlify and other deploy tools), latest per context. */
  statuses: { state: string }[] | null;
  waitingSince: Date;
  now: Date;
}

export type AutopilotHoldDecision =
  | { action: "publish" }
  | { action: "wait" }
  /** Behind a base branch that must be up to date: bring the base in first. */
  | { action: "update" }
  | { action: "cancel"; reason: AutopilotHoldReason };
