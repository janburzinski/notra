"use client";

import { PowerIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AUTOPILOT_APPROVAL_GROUPS,
  AUTOPILOT_APPROVAL_MODES,
  AUTOPILOT_MAX_WORKSPACE_REVIEWERS,
} from "@notra/db/constants/autopilot";
import type { AutopilotApprovalMode } from "@notra/db/types/autopilot";
import { autopilotReviewerSchema } from "@notra/schemas/dashboard/autopilot";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import { Input } from "@notra/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Switch } from "@notra/ui/components/ui/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@notra/ui/components/ui/toggle-group";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { AutopilotReleaseFiltersSection } from "@/components/autopilot/autopilot-release-filters-section";
import { AutopilotRepositoryPicker } from "@/components/autopilot/autopilot-repository-picker";
import { AutopilotRulesSection } from "@/components/autopilot/autopilot-rules-section";
import {
  AutopilotSettingsField,
  AutopilotSettingsFields,
} from "@/components/autopilot/autopilot-settings-field";
import { AutopilotSourceRepositoriesRow } from "@/components/autopilot/autopilot-source-repositories-row";
import { AutopilotTagInput } from "@/components/autopilot/autopilot-tag-input";
import { Button } from "@/components/button";
import { SiteSettingsHint } from "@/components/sites/site-settings-item";
import {
  AUTOPILOT_DRAFT_EMAIL_OPTIONS,
  AUTOPILOT_HOUR_OPTIONS,
  AUTOPILOT_STALE_OPTIONS,
} from "@/constants/autopilot";
import { AUTOPILOT_NO_SITE } from "@/constants/autopilot-publish";
import { AUTOPILOT_SLACK_CHANNEL_HINT } from "@/constants/autopilot-slack";
import { AUTOPILOT_SETTINGS_CONTROL_CLASSNAME } from "@/constants/autopilot-ui";
import type {
  AutopilotHousekeepingSettingsProps,
  AutopilotIgnoredSettingsProps,
  AutopilotSettingsSectionProps,
  AutopilotTurnOffRowProps,
} from "@/types/autopilot";
import { normalizeAutopilotReviewers } from "@/utils/autopilot-reviewers";
import { autopilotSiteOptions, toStaleDays } from "@/utils/autopilot-settings";

function parseReviewer(value: string) {
  const parsed = autopilotReviewerSchema.safeParse(value);
  return parsed.success
    ? (normalizeAutopilotReviewers([parsed.data])[0] ?? null)
    : null;
}

export function AutopilotPublishingSettings({
  organizationId,
  overview,
  connections,
  save,
}: AutopilotSettingsSectionProps) {
  const t = useTranslations("autopilot.settings");
  const { settings } = overview;
  const siteOptions = autopilotSiteOptions(overview, {
    none: t("siteNone"),
    withoutBlog: t("siteWithoutBlog"),
  });
  return (
    <AutopilotSettingsFields>
      {overview.sites.length > 0 || settings.siteId ? (
        <AutopilotSettingsField
          description={t("siteDescription")}
          htmlFor="autopilot-site"
          label={t("site")}
        >
          <Select
            items={siteOptions}
            onValueChange={(value) =>
              save(
                value === AUTOPILOT_NO_SITE
                  ? // Picking a site copies its target over the manual one,
                    // so leaving it sends the target shown here, whichever
                    // save the server sees first.
                    {
                      siteId: null,
                      repository: settings.repository,
                      contentPath: settings.contentPath,
                    }
                  : { siteId: value }
              )
            }
            value={settings.siteId ?? AUTOPILOT_NO_SITE}
          >
            <SelectTrigger
              className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}
              id="autopilot-site"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {siteOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AutopilotSettingsField>
      ) : null}
      {settings.siteId ? null : (
        <>
          <AutopilotSettingsField
            description={t("repositoryDescription")}
            htmlFor="autopilot-repository"
            label={t("repository")}
          >
            {connections.githubConnected ? (
              <AutopilotRepositoryPicker
                className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}
                id="autopilot-repository"
                onChange={(repository) =>
                  save({
                    repository: {
                      owner: repository.owner,
                      name: repository.name,
                      branch: repository.defaultBranch,
                    },
                  })
                }
                repositories={connections.repositories}
                value={
                  settings.repository
                    ? `${settings.repository.owner}/${settings.repository.name}`
                    : null
                }
              />
            ) : (
              <Button
                loading={connections.installing}
                onClick={connections.installGitHub}
                size="sm"
                variant="outline"
              >
                {t("connectGitHub")}
              </Button>
            )}
          </AutopilotSettingsField>
          <AutopilotSettingsField
            description={t("blogFolderDescription")}
            htmlFor="autopilot-blog-folder"
            label={t("blogFolder")}
          >
            <Input
              className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}
              defaultValue={settings.contentPath ?? ""}
              id="autopilot-blog-folder"
              // Remounts with the saved, normalized value after each save.
              key={settings.contentPath ?? ""}
              onBlur={(event) => {
                const contentPath = event.currentTarget.value.trim();
                if (contentPath !== (settings.contentPath ?? "")) {
                  save({ contentPath: contentPath || null });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.currentTarget.blur();
                }
              }}
              placeholder={t("blogFolderPlaceholder")}
            />
          </AutopilotSettingsField>
        </>
      )}
      {connections.githubConnected ? (
        <AutopilotSourceRepositoriesRow
          filters={settings.commitFilters}
          organizationId={organizationId}
          repositories={connections.repositories}
        />
      ) : null}
      <AutopilotSettingsField
        description={t("reviewersDescription", {
          max: AUTOPILOT_MAX_WORKSPACE_REVIEWERS,
        })}
        htmlFor="autopilot-reviewers"
        label={t("reviewers")}
      >
        <div className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}>
          <AutopilotTagInput
            id="autopilot-reviewers"
            label={t("reviewers")}
            max={AUTOPILOT_MAX_WORKSPACE_REVIEWERS}
            onChange={(reviewers) => save({ reviewers })}
            parse={parseReviewer}
            placeholder={t("reviewersPlaceholder")}
            values={settings.reviewers}
          />
        </div>
      </AutopilotSettingsField>
    </AutopilotSettingsFields>
  );
}

export function AutopilotBriefSettings({
  overview,
  connections,
  save,
}: AutopilotSettingsSectionProps) {
  const t = useTranslations("autopilot.settings");
  const { settings } = overview;
  const { slackIntegration, channels } = connections;
  return (
    <AutopilotSettingsFields>
      <AutopilotSettingsField
        description={
          slackIntegration
            ? AUTOPILOT_SLACK_CHANNEL_HINT
            : t("slackChannelConnectDescription")
        }
        htmlFor="autopilot-slack-channel"
        label={t("slackChannel")}
      >
        {slackIntegration ? (
          <Select
            items={channels.map((channel) => ({
              value: channel.id,
              label: `#${channel.name}`,
            }))}
            onValueChange={(value) => {
              const channel = channels.find((row) => row.id === value);
              if (channel) {
                save({
                  slack: {
                    integrationId: slackIntegration.id,
                    channelId: channel.id,
                    channelName: channel.name,
                  },
                });
              }
            }}
            value={settings.slackChannelId}
          >
            <SelectTrigger
              className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}
              id="autopilot-slack-channel"
            >
              <SelectValue placeholder={t("slackChannelPlaceholder")} />
            </SelectTrigger>
            <SelectContent align="end">
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  #{channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button
            nativeButton={false}
            render={<a href={connections.slackAuthorizeUrl} />}
            size="sm"
            variant="outline"
          >
            {t("connectSlack")}
          </Button>
        )}
      </AutopilotSettingsField>
      <AutopilotSettingsField
        description={settings.timezone}
        htmlFor="autopilot-brief-hour"
        label={t("briefHour")}
      >
        <Select
          items={AUTOPILOT_HOUR_OPTIONS}
          onValueChange={(value) => save({ briefHour: Number(value) })}
          value={String(settings.briefHour)}
        >
          <SelectTrigger
            className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}
            id="autopilot-brief-hour"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {AUTOPILOT_HOUR_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AutopilotSettingsField>
      <AutopilotSettingsField
        description={t("draftEmailsDescription")}
        htmlFor="autopilot-draft-emails"
        label={t("draftEmails")}
      >
        <Select
          items={AUTOPILOT_DRAFT_EMAIL_OPTIONS}
          onValueChange={(value) => {
            const option = AUTOPILOT_DRAFT_EMAIL_OPTIONS.find(
              (candidate) => candidate.value === value
            );
            if (option) {
              save({ draftEmails: option.value });
            }
          }}
          value={settings.draftEmails}
        >
          <SelectTrigger
            className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}
            id="autopilot-draft-emails"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {AUTOPILOT_DRAFT_EMAIL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AutopilotSettingsField>
    </AutopilotSettingsFields>
  );
}

export function AutopilotApprovalSettings({
  overview,
  save,
}: AutopilotSettingsSectionProps) {
  const t = useTranslations("autopilot.settings");
  const labels = {
    posts: t("approvalPosts"),
    updates: t("approvalUpdates"),
    fixes: t("approvalFixes"),
  };
  return (
    <div className="flex flex-col gap-4">
      <SiteSettingsHint>{t("approvalsHint")}</SiteSettingsHint>
      <AutopilotSettingsFields>
        {AUTOPILOT_APPROVAL_GROUPS.map((group) => {
          const current = overview.settings.approvals[group];
          // Sends only this group; the server merges it into the others.
          const choose = (mode: AutopilotApprovalMode) =>
            save({ approvals: { [group]: mode } });
          return (
            <AutopilotSettingsField key={group} label={labels[group]}>
              {/* The segmented group always fills its box, so the box sets the width. */}
              <div className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}>
                <ToggleGroup
                  aria-label={labels[group]}
                  size="sm"
                  value={[current]}
                  variant="segmented"
                >
                  {AUTOPILOT_APPROVAL_MODES.map((mode) => (
                    <ToggleGroupItem
                      key={mode}
                      onClick={() => choose(mode)}
                      value={mode}
                    >
                      {mode === "ask" ? t("approvalAsk") : t("approvalAuto")}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </AutopilotSettingsField>
          );
        })}
      </AutopilotSettingsFields>
    </div>
  );
}

export function AutopilotHousekeepingSettings({
  overview,
  save,
  onPromptCleanupChange,
}: AutopilotHousekeepingSettingsProps) {
  const t = useTranslations("autopilot.settings");
  const { settings } = overview;
  return (
    <AutopilotSettingsFields>
      <AutopilotSettingsField
        htmlFor="autopilot-stale-days"
        label={t("staleDrafts")}
      >
        <Select
          items={AUTOPILOT_STALE_OPTIONS}
          onValueChange={(value) =>
            save({
              stalePullRequestDays:
                value === "never" ? null : toStaleDays(Number(value)),
            })
          }
          value={
            settings.stalePullRequestDays === null
              ? "never"
              : String(settings.stalePullRequestDays)
          }
        >
          <SelectTrigger
            className={AUTOPILOT_SETTINGS_CONTROL_CLASSNAME}
            id="autopilot-stale-days"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {AUTOPILOT_STALE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AutopilotSettingsField>
      <AutopilotSettingsField
        description={t("promptCleanupDescription")}
        htmlFor="autopilot-prompt-cleanup"
        label={t("promptCleanup")}
      >
        <Switch
          checked={settings.jobs.prompts}
          id="autopilot-prompt-cleanup"
          onCheckedChange={onPromptCleanupChange}
        />
      </AutopilotSettingsField>
    </AutopilotSettingsFields>
  );
}

export function AutopilotIgnoredSettings({
  organizationId,
  overview,
  connections,
}: AutopilotIgnoredSettingsProps) {
  return (
    <div className="flex flex-col gap-3">
      <AutopilotReleaseFiltersSection
        filters={overview.settings.commitFilters}
        githubConnected={connections.githubConnected}
        organizationId={organizationId}
        repositories={connections.repositories}
      />
      <AutopilotRulesSection
        organizationId={organizationId}
        rules={overview.rules}
      />
    </div>
  );
}

/** Turning Autopilot off is a decision, so it asks first. */
export function AutopilotTurnOffRow({ onTurnOff }: AutopilotTurnOffRowProps) {
  const t = useTranslations("autopilot.settings.turnOff");
  const [open, setOpen] = useState(false);
  return (
    // On phones the button drops under the text, like the summaries above it.
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 sm:flex sm:px-5">
      <span className="text-muted-foreground flex size-5 shrink-0 items-center justify-center">
        <HugeiconsIcon
          aria-hidden="true"
          className="size-4.5"
          icon={PowerIcon}
          strokeWidth={1.75}
        />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium">{t("title")}</p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t("description")}
        </p>
      </div>
      <div className="col-start-2 justify-self-start sm:shrink-0">
        <ConfirmDialog
          confirmLabel={t("confirm")}
          description={t("confirmDescription")}
          // A failed save already shows a toast; the dialog stays open to retry.
          onConfirm={() =>
            onTurnOff()
              .then(() => setOpen(false))
              .catch(() => undefined)
          }
          onOpenChange={setOpen}
          open={open}
          title={t("confirmTitle")}
          trigger={<Button variant="destructive">{t("button")}</Button>}
          variant="destructive"
        />
      </div>
      {/* Lines the button up with the summaries, which sit before a chevron. */}
      <span aria-hidden="true" className="hidden size-4 shrink-0 sm:block" />
    </div>
  );
}
