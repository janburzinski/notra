import type { AutopilotFindingStatus } from "@notra/db/types/autopilot";

/** A hover preload counts as fresh this long, so moving over cards doesn't refetch. */
export const ARTIFACT_PRELOAD_STALE_MS = 30_000;

/** A table cell that is a change, like +18%, -3% (or a real minus) or 0%. */
export const ARTIFACT_SIGNED_CHANGE = /^([+\-\u2212])?\s?(\d[\d.,\s]*)/;

/** A text block that is only a heading, which introduces the block below. */
export const ARTIFACT_HEADING_ONLY = /^#{1,6} [^\n]+$/;

/** How often an artifact with Autopilot items in flight checks for changes. */
export const ARTIFACT_AUTOPILOT_REFRESH_MS = 15_000;

/** An Autopilot item's stage on a public copy, where it has no buttons. */
export const ARTIFACT_SHARED_FINDING_STAGES: Record<
  AutopilotFindingStatus,
  string
> = {
  suggested: "Idea",
  open: "Writing",
  proposed: "Ready to merge",
  merged: "Merged",
  dismissed: "Closed",
  expired: "Expired",
  failed: "Failed",
};
