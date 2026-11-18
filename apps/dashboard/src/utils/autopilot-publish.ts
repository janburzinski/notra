import type {
  AutopilotApprovalGroup,
  AutopilotJobKind,
} from "@notra/db/types/autopilot";

import {
  AUTOPILOT_APPROVAL_GROUP_BY_KIND,
  AUTOPILOT_COMPARE_FILE_LIMIT,
  AUTOPILOT_FACT_FLAG_HEADINGS,
  AUTOPILOT_FAILED_CHECK_CONCLUSIONS,
  AUTOPILOT_FAILED_STATUS_STATES,
  AUTOPILOT_HOLD_REASONS,
  AUTOPILOT_PUBLISH_HOUR,
  AUTOPILOT_PUBLISH_MIN_HOLD_MS,
  AUTOPILOT_PUBLISH_WAIT_LIMIT_MS,
  AUTOPILOT_SAFE_FIX_FILES,
  AUTOPILOT_WEEKEND_DAYS,
} from "@/constants/autopilot-publish";
import type {
  AutopilotHoldDecision,
  AutopilotHoldInput,
} from "@/types/autopilot-publish";
import {
  autopilotLocalFormatter,
  autopilotLocalParts,
} from "@/utils/autopilot-schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_DAYS = 14;

function utcOffset(instant: number, formatter: Intl.DateTimeFormat) {
  const local = autopilotLocalParts(new Date(instant), formatter);
  const [year, month, day] = local.day.split("-").map(Number);
  const wall = Date.UTC(
    year ?? 1970,
    (month ?? 1) - 1,
    day ?? 1,
    local.hour,
    local.minute,
    local.second
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

function zonedInstant(
  calendarDay: Date,
  hour: number,
  formatter: Intl.DateTimeFormat
) {
  const wall = Date.UTC(
    calendarDay.getUTCFullYear(),
    calendarDay.getUTCMonth(),
    calendarDay.getUTCDate(),
    hour
  );
  const first = wall - utcOffset(wall, formatter);
  const second = wall - utcOffset(first, formatter);
  return new Date(second);
}

export function nextAutopilotPublishAt(now: Date, timezone: string) {
  const formatter = autopilotLocalFormatter(timezone);
  const [year, month, day] = autopilotLocalParts(now, formatter)
    .day.split("-")
    .map(Number);
  const today = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  for (let offset = 0; offset <= SEARCH_DAYS; offset += 1) {
    const calendarDay = new Date(today + offset * DAY_MS);
    if (AUTOPILOT_WEEKEND_DAYS.has(calendarDay.getUTCDay())) {
      continue;
    }
    const at = zonedInstant(calendarDay, AUTOPILOT_PUBLISH_HOUR, formatter);
    if (at.getTime() - now.getTime() >= AUTOPILOT_PUBLISH_MIN_HOLD_MS) {
      return at;
    }
  }
  return new Date(now.getTime() + AUTOPILOT_PUBLISH_MIN_HOLD_MS);
}

export function formatAutopilotPublishAt(date: Date, timezone: string) {
  const options = {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  } as const;
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }
}

export function autopilotApprovalGroup(
  kind: AutopilotJobKind,
  updatesExistingPage: boolean
): AutopilotApprovalGroup | null {
  const group = AUTOPILOT_APPROVAL_GROUP_BY_KIND[kind] ?? null;
  return group === "posts" && updatesExistingPage ? "updates" : group;
}

export function hasFactCheckFlags(pullRequestBody: string) {
  return Object.values(AUTOPILOT_FACT_FLAG_HEADINGS).some((heading) =>
    pullRequestBody.includes(heading)
  );
}

export function touchesPathsOutside(
  paths: string[],
  folders: (string | null)[]
) {
  const roots = folders
    .map((folder) => folder?.replace(/^\/+|\/+$/g, "") ?? "")
    .filter(Boolean);
  return paths.some(
    (path) =>
      !(
        roots.some((root) => path === root || path.startsWith(`${root}/`)) ||
        AUTOPILOT_SAFE_FIX_FILES.some((pattern) => pattern.test(path))
      )
  );
}

export function pullRequestEventHoldReason(
  action: string,
  senderType: string | null,
  baseChanged = false
) {
  if (action === "converted_to_draft") {
    return AUTOPILOT_HOLD_REASONS.draft;
  }
  if (action === "edited" && baseChanged) {
    return AUTOPILOT_HOLD_REASONS.retargeted;
  }
  if (action === "synchronize" && senderType !== "Bot") {
    return AUTOPILOT_HOLD_REASONS.pushed;
  }
  return null;
}

function waitOrGiveUp(input: AutopilotHoldInput): AutopilotHoldDecision {
  return input.now.getTime() - input.waitingSince.getTime() >
    AUTOPILOT_PUBLISH_WAIT_LIMIT_MS
    ? { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.checksStuck }
    : { action: "wait" };
}

export function autopilotHoldDecision(
  input: AutopilotHoldInput
): AutopilotHoldDecision {
  const pull = input.pullRequest;
  if (pull.merged) {
    return { action: "publish" };
  }
  if (pull.state !== "open") {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.closed };
  }
  if (pull.draft) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.draft };
  }
  if (input.expectedBaseRef && pull.baseRef !== input.expectedBaseRef) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.retargeted };
  }
  if (input.expectedHeadSha && pull.headSha !== input.expectedHeadSha) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.pushed };
  }
  if (input.truncated) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.tooBusy };
  }
  const human = input.reviews.filter((review) => !review.bot);
  if (human.some((review) => review.state === "CHANGES_REQUESTED")) {
    return {
      action: "cancel",
      reason: AUTOPILOT_HOLD_REASONS.changesRequested,
    };
  }
  if (
    input.humanComments > 0 ||
    human.some((review) => review.state === "COMMENTED")
  ) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.commented };
  }
  if (pull.mergeable === false || pull.mergeableState === "dirty") {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.conflict };
  }
  const { checks } = input;
  if (
    checks?.some(
      (check) =>
        check.status === "completed" &&
        AUTOPILOT_FAILED_CHECK_CONCLUSIONS.has(check.conclusion ?? "")
    )
  ) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.checksFailed };
  }
  const { statuses } = input;
  if (
    statuses?.some((status) => AUTOPILOT_FAILED_STATUS_STATES.has(status.state))
  ) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.checksFailed };
  }
  if (
    checks?.some((check) => check.status !== "completed") ||
    statuses?.some((status) => status.state === "pending")
  ) {
    return waitOrGiveUp(input);
  }
  if (pull.mergeableState === "behind") {
    return { action: "update" };
  }
  if (pull.mergeableState === "blocked" && checks) {
    return { action: "cancel", reason: AUTOPILOT_HOLD_REASONS.blocked };
  }
  if (
    pull.mergeable === null ||
    !(pull.mergeableState === "clean" || pull.mergeableState === "has_hooks")
  ) {
    return waitOrGiveUp(input);
  }
  return { action: "publish" };
}

/** One file in a GitHub compare, as far as a branch's own changes go. */
export interface AutopilotBranchChange {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  sha?: string | null;
}

function branchChangeKey(change: AutopilotBranchChange) {
  // Only the added and removed lines: hunk headers and context lines move
  // when the base changes the same file elsewhere.
  const content =
    change.patch === undefined
      ? `blob:${change.sha ?? ""}`
      : change.patch
          .split("\n")
          .filter((line) => line.startsWith("+") || line.startsWith("-"))
          .join("\n");
  return [
    change.filename,
    change.previous_filename ?? "",
    change.status,
    change.additions,
    change.deletions,
    content,
  ].join("\0");
}

/**
 * Whether a branch still changes exactly what it changed before the base was
 * merged into it: same files, same lines. Anything more is someone else's work.
 */
export function sameBranchChanges(
  before: AutopilotBranchChange[],
  after: AutopilotBranchChange[]
) {
  if (
    before.length !== after.length ||
    before.length >= AUTOPILOT_COMPARE_FILE_LIMIT
  ) {
    return false;
  }
  const expected = new Set(before.map(branchChangeKey));
  return after.every((change) => expected.has(branchChangeKey(change)));
}
