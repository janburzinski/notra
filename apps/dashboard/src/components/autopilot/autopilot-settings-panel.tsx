"use client";

import { AUTOPILOT_APPROVAL_GROUPS } from "@notra/db/constants/autopilot";
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import {
  AutopilotApprovalSettings,
  AutopilotBriefSettings,
  AutopilotHousekeepingSettings,
  AutopilotIgnoredSettings,
  AutopilotPublishingSettings,
  AutopilotTurnOffRow,
} from "@/components/autopilot/autopilot-settings-sections";
import {
  SiteSettingsItem,
  SiteSettingsList,
  SiteSettingsValue,
} from "@/components/sites/site-settings-item";
import { AUTOPILOT_HOUR_OPTIONS } from "@/constants/autopilot";
import {
  AUTOPILOT_SETTINGS_SECTION_ICONS,
  AUTOPILOT_SETTINGS_SECTION_IDS,
} from "@/constants/autopilot-ui";
import { useAutopilotConnections } from "@/lib/hooks/use-autopilot-connections";
import { useAutopilotSettingsSave } from "@/lib/hooks/use-autopilot-settings-save";
import type {
  AutopilotSettingsPanelProps,
  AutopilotSettingsSectionId,
} from "@/types/autopilot";
import { autopilotSiteOptions } from "@/utils/autopilot-settings";

/**
 * One row per group that says what is set; open a row to change it. Every
 * change saves on its own.
 */
export function AutopilotSettingsPanel({
  organizationId,
  callbackPath,
  overview,
}: AutopilotSettingsPanelProps) {
  const t = useTranslations("autopilot.settings");
  const { settings } = overview;
  const connections = useAutopilotConnections({
    organizationId,
    callbackPath,
    overview,
  });
  const { save, setPromptCleanup } = useAutopilotSettingsSave(
    organizationId,
    settings
  );
  const [open, setOpen] = useState<AutopilotSettingsSectionId | null>(null);
  const sectionProps = {
    organizationId,
    overview,
    connections,
    save: save.mutate,
  };

  const site = autopilotSiteOptions(overview, {
    none: t("siteNone"),
    withoutBlog: t("siteWithoutBlog"),
  }).find((option) => option.value === settings.siteId);
  // The owner rarely tells repositories apart and pushes the folder out of view.
  const repository = settings.repository?.name ?? null;
  const hour =
    AUTOPILOT_HOUR_OPTIONS.find(
      (option) => option.value === String(settings.briefHour)
    )?.label ?? String(settings.briefHour);
  const approvalLabels = {
    posts: t("approvalPosts"),
    updates: t("approvalUpdates"),
    fixes: t("approvalFixes"),
  };
  const autoGroups = AUTOPILOT_APPROVAL_GROUPS.filter(
    (group) => settings.approvals[group] === "auto"
  );
  const filters = settings.commitFilters;
  const ignored = [
    filters.excludedAuthors.length > 0
      ? t("summary.ignoredAuthors", { count: filters.excludedAuthors.length })
      : null,
    Object.keys(filters.paths).length > 0
      ? t("summary.ignoredPaths", { count: Object.keys(filters.paths).length })
      : null,
    overview.rules.length > 0
      ? t("summary.ignoredTopics", { count: overview.rules.length })
      : null,
  ].filter((part) => part !== null);

  let publishingSummary = t("summary.notSetUp");
  if (site) {
    publishingSummary = site.label;
  } else if (repository) {
    publishingSummary = settings.contentPath
      ? `${repository} · ${settings.contentPath}`
      : repository;
  }
  let briefSummary = t("summary.briefNoSlack");
  if (connections.slackIntegration) {
    briefSummary = settings.slackChannelName
      ? t("summary.briefSlack", {
          channel: settings.slackChannelName,
          time: hour,
        })
      : t("summary.briefNoChannel", { time: hour });
  }
  let approvalsSummary = t("summary.approvalsSome", {
    groups: autoGroups.map((group) => approvalLabels[group]).join(", "),
  });
  if (autoGroups.length === 0) {
    approvalsSummary = t("summary.approvalsAsk");
  } else if (autoGroups.length === AUTOPILOT_APPROVAL_GROUPS.length) {
    approvalsSummary = t("summary.approvalsAuto");
  }

  const sections: Record<
    AutopilotSettingsSectionId,
    { summary: string; content: ReactNode }
  > = {
    publishing: {
      summary: publishingSummary,
      content: <AutopilotPublishingSettings {...sectionProps} />,
    },
    brief: {
      summary: briefSummary,
      content: <AutopilotBriefSettings {...sectionProps} />,
    },
    approvals: {
      summary: approvalsSummary,
      content: <AutopilotApprovalSettings {...sectionProps} />,
    },
    housekeeping: {
      summary:
        settings.stalePullRequestDays === null
          ? t("summary.staleNever")
          : t("summary.staleDays", { days: settings.stalePullRequestDays }),
      content: (
        <AutopilotHousekeepingSettings
          {...sectionProps}
          onPromptCleanupChange={(enabled) => setPromptCleanup.mutate(enabled)}
        />
      ),
    },
    ignored: {
      summary: ignored.length > 0 ? ignored.join(" · ") : t("summary.none"),
      content: (
        <AutopilotIgnoredSettings
          connections={connections}
          organizationId={organizationId}
          overview={overview}
        />
      ),
    },
  };

  return (
    <SiteSettingsList>
      {AUTOPILOT_SETTINGS_SECTION_IDS.map((id) => (
        <SiteSettingsItem
          description={t(`sections.${id}.description`)}
          icon={AUTOPILOT_SETTINGS_SECTION_ICONS[id]}
          key={id}
          onOpenChange={(next) => setOpen(next ? id : null)}
          open={open === id}
          title={t(`sections.${id}.title`)}
          value={<SiteSettingsValue>{sections[id].summary}</SiteSettingsValue>}
        >
          {sections[id].content}
        </SiteSettingsItem>
      ))}
      <AutopilotTurnOffRow
        onTurnOff={() => save.mutateAsync({ enabled: false })}
      />
    </SiteSettingsList>
  );
}
