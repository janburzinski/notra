import {
  AUTOPILOT_HEALTH_HIGH_FAILURE_RATE,
  AUTOPILOT_HEALTH_LOW_MERGE_RATE,
  AUTOPILOT_HEALTH_MIN_DECIDED,
  AUTOPILOT_HEALTH_MIN_FAILED_RUNS,
  AUTOPILOT_HEARTBEAT_WARNING_MS,
  AUTOPILOT_JOB_LABELS,
} from "@/constants/autopilot";
import type {
  AutopilotAdminRun,
  AutopilotAttentionItem,
  AutopilotHealth,
  AutopilotHealthTemplate,
} from "@/types/autopilot";

export function autopilotTimestamp(value: string) {
  return `${new Date(value).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function autopilotDuration(run: AutopilotAdminRun, now = Date.now()) {
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  const seconds = Math.max(
    0,
    Math.floor((end - new Date(run.startedAt).getTime()) / 1000)
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function hasMissingAutopilotHeartbeat(
  run: AutopilotAdminRun,
  now = Date.now()
) {
  return (
    run.status === "running" &&
    now - new Date(run.heartbeatAt).getTime() > AUTOPILOT_HEARTBEAT_WARNING_MS
  );
}

export function autopilotGitHubUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function autopilotRelatedUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "github.com" || url.hostname === "app.slack.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Merged drafts out of every draft a person merged or closed. */
export function autopilotMergeRate(
  template: Pick<AutopilotHealthTemplate, "merged" | "dismissed" | "expired">
) {
  const decided = template.merged + template.dismissed + template.expired;
  return {
    decided,
    rate: decided > 0 ? template.merged / decided : null,
  };
}

export function autopilotFailureRate(
  template: Pick<AutopilotHealthTemplate, "runs" | "failedRuns">
) {
  return template.runs > 0 ? template.failedRuns / template.runs : null;
}

export function formatAutopilotRate(rate: number | null) {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export function formatAutopilotDurationMs(ms: number | null) {
  if (ms === null) {
    return "—";
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}m ${seconds % 60}s`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * What an admin should look at first: runs that stopped reporting, templates
 * that fail too often, and templates whose drafts people keep closing.
 */
export function autopilotAttention(
  health: AutopilotHealth,
  slug: string
): AutopilotAttentionItem[] {
  const items: AutopilotAttentionItem[] = [];
  const [oldest] = health.stuck;
  if (oldest) {
    items.push({
      id: "stuck",
      tone: "destructive",
      title: `${health.stuck.length} ${health.stuck.length === 1 ? "run has" : "runs have"} stopped reporting`,
      detail: `No heartbeat for over five minutes. Oldest: ${oldest.organizationSlug}.`,
      href: `/${slug}/autopilot/${encodeURIComponent(oldest.id)}`,
    });
  }
  for (const template of health.templates) {
    const label = AUTOPILOT_JOB_LABELS[template.kind];
    const failureRate = autopilotFailureRate(template);
    if (
      failureRate !== null &&
      template.failedRuns >= AUTOPILOT_HEALTH_MIN_FAILED_RUNS &&
      failureRate > AUTOPILOT_HEALTH_HIGH_FAILURE_RATE
    ) {
      items.push({
        id: `fails-${template.kind}`,
        tone: "destructive",
        title: `${label} fails in ${formatAutopilotRate(failureRate)} of runs`,
        detail: `${template.failedRuns} of ${template.runs} runs logged an error.`,
        href: null,
      });
    }
    const { decided, rate } = autopilotMergeRate(template);
    if (
      rate !== null &&
      decided >= AUTOPILOT_HEALTH_MIN_DECIDED &&
      rate < AUTOPILOT_HEALTH_LOW_MERGE_RATE
    ) {
      items.push({
        id: `merges-${template.kind}`,
        tone: "warning",
        title: `${label}: ${template.merged} of ${decided} drafts merged`,
        detail: "People close most of what this template writes.",
        href: null,
      });
    }
  }
  return items;
}
