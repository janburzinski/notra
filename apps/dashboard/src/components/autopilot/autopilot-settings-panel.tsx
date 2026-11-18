"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";

import { AutopilotRedoOnboardingRow } from "@/components/autopilot/autopilot-redo-onboarding-row";
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
import {
  AUTOPILOT_SETTINGS_SECTION_ICONS,
  AUTOPILOT_SETTINGS_SECTION_IDS,
} from "@/constants/autopilot-ui";
import { useAutopilotConnections } from "@/lib/hooks/use-autopilot-connections";
import { useAutopilotSettingsSave } from "@/lib/hooks/use-autopilot-settings-save";
import { useAutopilotSettingsSummaries } from "@/lib/hooks/use-autopilot-settings-summaries";
import type {
  AutopilotSettingsPanelProps,
  AutopilotSettingsSectionId,
} from "@/types/autopilot";

/**
 * One row per group that says what is set; open a row to change it. Every
 * change saves on its own.
 */
export function AutopilotSettingsPanel({
  organizationId,
  callbackPath,
  overview: loaded,
}: AutopilotSettingsPanelProps) {
  const t = useTranslations("autopilot.settings");
  const { settings, save, setPromptCleanup } = useAutopilotSettingsSave(
    organizationId,
    loaded.settings
  );
  // The loaded overview with the changes still on their way laid on top.
  const overview = { ...loaded, settings };
  const connections = useAutopilotConnections({
    organizationId,
    callbackPath,
    overview,
  });
  const [open, setOpen] = useState<AutopilotSettingsSectionId | null>(null);
  const summaries = useAutopilotSettingsSummaries(
    overview,
    Boolean(connections.slackIntegration)
  );
  const sectionProps = {
    organizationId,
    overview,
    connections,
    save: save.mutate,
  };
  const content: Record<AutopilotSettingsSectionId, ReactNode> = {
    publishing: <AutopilotPublishingSettings {...sectionProps} />,
    brief: <AutopilotBriefSettings {...sectionProps} />,
    approvals: <AutopilotApprovalSettings {...sectionProps} />,
    housekeeping: (
      <AutopilotHousekeepingSettings
        {...sectionProps}
        onPromptCleanupChange={setPromptCleanup}
      />
    ),
    ignored: (
      <AutopilotIgnoredSettings
        connections={connections}
        organizationId={organizationId}
        overview={overview}
      />
    ),
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
          value={<SiteSettingsValue>{summaries[id]}</SiteSettingsValue>}
        >
          {content[id]}
        </SiteSettingsItem>
      ))}
      <AutopilotTurnOffRow
        onTurnOff={() => save.mutateAsync({ enabled: false })}
      />
      {loaded.canResetOnboarding ? (
        <AutopilotRedoOnboardingRow organizationId={organizationId} />
      ) : null}
    </SiteSettingsList>
  );
}
