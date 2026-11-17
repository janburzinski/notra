import { AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS } from "@/constants/autopilot";
import { AUTOPILOT_NO_SITE } from "@/constants/autopilot-publish";
import type {
  AutopilotSettingsPendingChange,
  AutopilotSettingsSectionProps,
  AutopilotSettingsView,
} from "@/types/autopilot";
import { normalizeAutopilotReviewers } from "@/utils/autopilot-reviewers";

type StaleDays = (typeof AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS)[number];

export function toStaleDays(value: number | null): StaleDays | null {
  return (
    AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS.find((days) => days === value) ??
    null
  );
}

/**
 * The settings as they will read once a change lands, so the page can show
 * it before the server confirms it. The refetch afterwards fills in what only
 * the server knows, like a site's repository or a normalized folder.
 */
export function applyAutopilotSettingsPatch(
  settings: AutopilotSettingsView,
  patch: AutopilotSettingsPendingChange
): AutopilotSettingsView {
  const keep = <T>(value: T | undefined, current: T) =>
    value === undefined ? current : value;
  return {
    ...settings,
    enabled: keep(patch.enabled, settings.enabled),
    repository: keep(patch.repository, settings.repository),
    contentPath: keep(patch.contentPath, settings.contentPath),
    ...(patch.slack === undefined
      ? {}
      : {
          slackIntegrationId: patch.slack?.integrationId ?? null,
          slackChannelId: patch.slack?.channelId ?? null,
          slackChannelName: patch.slack?.channelName ?? null,
        }),
    briefHour: keep(patch.briefHour, settings.briefHour),
    stalePullRequestDays: keep(
      patch.stalePullRequestDays,
      settings.stalePullRequestDays
    ),
    approvals: { ...settings.approvals, ...patch.approvals },
    jobs: { ...settings.jobs, ...patch.jobs },
    draftEmails: keep(patch.draftEmails, settings.draftEmails),
    reviewers: patch.reviewers
      ? normalizeAutopilotReviewers(patch.reviewers)
      : settings.reviewers,
    siteId: keep(patch.siteId, settings.siteId),
  };
}

/** Sites the posts can go to, plus a saved site Autopilot no longer lists. */
export function autopilotSiteOptions(
  overview: AutopilotSettingsSectionProps["overview"],
  labels: { none: string; withoutBlog: string }
) {
  const { settings } = overview;
  return [
    { value: AUTOPILOT_NO_SITE, label: labels.none },
    ...overview.sites.map((site) => ({ value: site.id, label: site.name })),
    ...(settings.siteId &&
    !overview.sites.some((site) => site.id === settings.siteId)
      ? [{ value: settings.siteId, label: labels.withoutBlog }]
      : []),
  ];
}
