import {
  AUTOPILOT_IDEA_AUTO_WRITE_DAYS,
  AUTOPILOT_JEV_AUTO_PROPOSE_CONFIDENCE,
} from "@/constants/autopilot";
import type { AutopilotFindingView } from "@/types/autopilot";
import { formatAutopilotPercent as percent } from "@/utils/autopilot-events";

const DAY_MS = 24 * 60 * 60 * 1000;

const BLOG_TITLE_PREFIX = /^Blog post(?: for |: )/i;
const WRAPPING_QUOTES = /^"(.*)"$/;

/** The title without the "Blog post:" prefix the table and Slack already imply. */
export function findingDisplayTitle(
  finding: Pick<AutopilotFindingView, "title">
) {
  return finding.title
    .replace(BLOG_TITLE_PREFIX, "")
    .replace(WRAPPING_QUOTES, "$1");
}

/** Has a pull request, or is being written into one by a run. */
function isPullRequestFinding(finding: AutopilotFindingView) {
  return (
    finding.pullRequestNumber !== null ||
    (finding.status === "open" && !finding.evidence.brief)
  );
}

/** Worth a post but not sure enough for a pull request, or being written from a click. */
export function isIdeaFinding(finding: AutopilotFindingView) {
  return (
    finding.status === "suggested" ||
    (finding.status === "open" && Boolean(finding.evidence.brief))
  );
}

/** Everything the pull requests tab lists: drafts and writes that failed. */
export function isListedPullRequest(finding: AutopilotFindingView) {
  return (
    (isPullRequestFinding(finding) || finding.status === "failed") &&
    !isIdeaFinding(finding)
  );
}

/** From when the daily run writes an idea nobody dismissed. */
export function ideaAutoWriteAt(finding: AutopilotFindingView) {
  return new Date(
    new Date(finding.createdAt).getTime() +
      AUTOPILOT_IDEA_AUTO_WRITE_DAYS * DAY_MS
  );
}

/**
 * Why Autopilot wrote this, or why it is still an idea, in one or two
 * sentences. `formatDate` keeps locale formatting with the caller.
 */
export function describeFindingReason(
  finding: AutopilotFindingView,
  formatDate: (date: Date) => string
) {
  if (finding.kind === "readiness") {
    return "Fixes website issues found by the readiness scan.";
  }
  const confidence = finding.evidence.confidence;
  const threshold =
    finding.evidence.decision?.threshold ??
    AUTOPILOT_JEV_AUTO_PROPOSE_CONFIDENCE;
  if (confidence === null || confidence === undefined) {
    return "Requested on GitHub.";
  }
  if (finding.status === "suggested") {
    return `Queued to write on the first run after ${formatDate(ideaAutoWriteAt(finding))} unless dismissed.`;
  }
  if (finding.evidence.autoWritten) {
    return `Written after ${AUTOPILOT_IDEA_AUTO_WRITE_DAYS} days without a dismissal.`;
  }
  if (confidence >= threshold) {
    return `Above the ${percent(threshold)} confidence threshold for a pull request.`;
  }
  return "Written on request from an idea.";
}
