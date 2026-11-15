"use client";

import { AUTOPILOT_APPROVAL_GROUPS } from "@notra/db/constants/autopilot";
import { useTranslations } from "use-intl";

import { AUTOPILOT_HOUR_OPTIONS } from "@/constants/autopilot";
import type {
  AutopilotSettingsPanelProps,
  AutopilotSettingsSectionId,
} from "@/types/autopilot";
import { autopilotSiteOptions } from "@/utils/autopilot-settings";

type Overview = AutopilotSettingsPanelProps["overview"];

function usePublishingSummary(overview: Overview) {
  const t = useTranslations("autopilot.settings");
  const { settings } = overview;
  const site = autopilotSiteOptions(overview, {
    none: t("siteNone"),
    withoutBlog: t("siteWithoutBlog"),
  }).find((option) => option.value === settings.siteId);
  if (site) {
    return site.label;
  }
  // The owner rarely tells repositories apart and pushes the folder out of view.
  const repository = settings.repository?.name;
  if (!repository) {
    return t("summary.notSetUp");
  }
  return settings.contentPath
    ? `${repository} · ${settings.contentPath}`
    : repository;
}

function useBriefSummary(overview: Overview, slackConnected: boolean) {
  const t = useTranslations("autopilot.settings");
  const { briefHour, slackChannelName } = overview.settings;
  if (!slackConnected) {
    return t("summary.briefNoSlack");
  }
  const time =
    AUTOPILOT_HOUR_OPTIONS.find((option) => option.value === String(briefHour))
      ?.label ?? String(briefHour);
  return slackChannelName
    ? t("summary.briefSlack", { channel: slackChannelName, time })
    : t("summary.briefNoChannel", { time });
}

function useApprovalsSummary(overview: Overview) {
  const t = useTranslations("autopilot.settings");
  const labels = {
    posts: t("approvalPosts"),
    updates: t("approvalUpdates"),
    fixes: t("approvalFixes"),
  };
  const auto = AUTOPILOT_APPROVAL_GROUPS.filter(
    (group) => overview.settings.approvals[group] === "auto"
  );
  if (auto.length === 0) {
    return t("summary.approvalsAsk");
  }
  if (auto.length === AUTOPILOT_APPROVAL_GROUPS.length) {
    return t("summary.approvalsAuto");
  }
  return t("summary.approvalsSome", {
    groups: auto.map((group) => labels[group]).join(", "),
  });
}

function useIgnoredSummary(overview: Overview) {
  const t = useTranslations("autopilot.settings");
  const authors = overview.settings.commitFilters.excludedAuthors.length;
  const paths = Object.keys(overview.settings.commitFilters.paths).length;
  const topics = overview.rules.length;
  const parts = [
    authors > 0 ? t("summary.ignoredAuthors", { count: authors }) : null,
    paths > 0 ? t("summary.ignoredPaths", { count: paths }) : null,
    topics > 0 ? t("summary.ignoredTopics", { count: topics }) : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : t("summary.none");
}

/** What each settings row says is set, shown while the row is closed. */
export function useAutopilotSettingsSummaries(
  overview: Overview,
  slackConnected: boolean
): Record<AutopilotSettingsSectionId, string> {
  const t = useTranslations("autopilot.settings");
  const days = overview.settings.stalePullRequestDays;
  return {
    publishing: usePublishingSummary(overview),
    brief: useBriefSummary(overview, slackConnected),
    approvals: useApprovalsSummary(overview),
    housekeeping:
      days === null
        ? t("summary.staleNever")
        : t("summary.staleDays", { days }),
    ignored: useIgnoredSummary(overview),
  };
}
