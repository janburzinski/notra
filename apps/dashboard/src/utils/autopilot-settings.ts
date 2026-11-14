import type { autopilotSaveInputSchema } from "@notra/schemas/dashboard/autopilot";
import type * as z from "zod";

import { AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS } from "@/constants/autopilot";
import { AUTOPILOT_NO_SITE } from "@/constants/autopilot-publish";
import type {
  AutopilotSettingsSectionProps,
  AutopilotSettingsView,
} from "@/types/autopilot";

type AutopilotSaveInput = z.input<typeof autopilotSaveInputSchema>;
type StaleDays = (typeof AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS)[number];

export function toStaleDays(value: number | null): StaleDays | null {
  return (
    AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS.find((days) => days === value) ??
    null
  );
}

/**
 * The saved settings as a save input, so one change can be sent on its own.
 * Jobs are left out: they change through their own endpoint, and resending
 * them here could undo a toggle that landed in between.
 */
export function toAutopilotSaveInput(
  organizationId: string,
  settings: AutopilotSettingsView
): AutopilotSaveInput {
  return {
    organizationId,
    enabled: settings.enabled,
    projectId: settings.projectId ?? undefined,
    repository: settings.repository,
    contentPath: settings.contentPath,
    slack:
      settings.slackIntegrationId && settings.slackChannelId
        ? {
            integrationId: settings.slackIntegrationId,
            channelId: settings.slackChannelId,
            channelName: settings.slackChannelName,
          }
        : null,
    briefHour: settings.briefHour,
    timezone: settings.timezone,
    maxOpenPullRequests: settings.maxOpenPullRequests,
    stalePullRequestDays: toStaleDays(settings.stalePullRequestDays),
    approvals: settings.approvals,
    draftEmails: settings.draftEmails,
    siteId: settings.siteId,
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
