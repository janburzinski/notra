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
  waitingSince: Date;
  now: Date;
}

export type AutopilotHoldDecision =
  | { action: "publish" }
  | { action: "wait" }
  | { action: "cancel"; reason: AutopilotHoldReason };
