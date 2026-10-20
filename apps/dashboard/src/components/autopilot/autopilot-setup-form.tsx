"use client";

import {
  Clock01Icon,
  Github01Icon,
  SlackIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AUTOPILOT_HOUR_OPTIONS } from "@/constants/autopilot";
import { AUTOPILOT_SLACK_CHANNEL_HINT } from "@/constants/autopilot-slack";
import { useAutopilotConnections } from "@/lib/hooks/use-autopilot-connections";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotSetupFormProps,
  AutopilotSetupRowProps,
} from "@/types/autopilot";
import { toErrorMessage } from "@/utils/error-message";

function SetupRow({ icon, title, children }: AutopilotSetupRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
        <span className="truncate text-sm font-medium">{title}</span>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

export function AutopilotSetupForm({
  organizationId,
  callbackPath,
  overview,
  projectId,
  submitLabel,
  onSaved,
}: AutopilotSetupFormProps) {
  const queryClient = useQueryClient();
  const { settings } = overview;
  const {
    githubConnected,
    slackIntegration,
    repositories,
    channels,
    installing,
    installGitHub,
    slackAuthorizeUrl,
  } = useAutopilotConnections({ organizationId, callbackPath, overview });

  const [repositoryKey, setRepositoryKey] = useState<string | null>(
    settings.repository
      ? `${settings.repository.owner}/${settings.repository.name}`
      : null
  );
  const [channelId, setChannelId] = useState<string | null>(
    settings.slackChannelId ?? slackIntegration?.notificationChannelId ?? null
  );
  const [briefHour, setBriefHour] = useState(settings.briefHour);
  // Keep the saved timezone; only the first setup takes the browser's.
  const timezone = settings.configured
    ? settings.timezone
    : Intl.DateTimeFormat().resolvedOptions().timeZone || settings.timezone;
  const selectedRepository =
    repositories.find((repository) => repository.fullName === repositoryKey) ??
    null;
  const selectedChannel =
    channels.find((channel) => channel.id === channelId) ?? null;

  const saveMutation = useMutation({
    mutationFn: () =>
      dashboardOrpc.autopilot.save.call({
        organizationId,
        enabled: true,
        // Settings are workspace-wide; keep a saved project over the one in scope.
        projectId: settings.projectId ?? projectId ?? undefined,
        repository: selectedRepository
          ? {
              owner: selectedRepository.owner,
              name: selectedRepository.name,
              branch:
                settings.repository?.owner === selectedRepository.owner &&
                settings.repository.name === selectedRepository.name
                  ? settings.repository.branch
                  : selectedRepository.defaultBranch,
            }
          : settings.repository,
        contentPath: settings.contentPath,
        slack:
          slackIntegration && channelId
            ? {
                integrationId: slackIntegration.id,
                channelId,
                channelName:
                  selectedChannel?.name ?? settings.slackChannelName ?? null,
              }
            : null,
        briefHour,
        timezone,
        jobs: settings.jobs,
        maxOpenPullRequests: settings.maxOpenPullRequests,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
      onSaved?.();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, "Could not save Autopilot"));
    },
  });

  // Slack is optional: without it the brief only shows up on the Autopilot page.
  const canSave = Boolean(selectedRepository || settings.repository);

  return (
    <div className="flex flex-col gap-6">
      <div className="divide-border divide-y">
        <SetupRow
          icon={<HugeiconsIcon className="size-4" icon={Github01Icon} />}
          title="Website repository"
        >
          {githubConnected ? (
            <Select
              items={repositories.map((repository) => ({
                value: repository.fullName,
                label: repository.fullName,
              }))}
              onValueChange={(value) => setRepositoryKey(value as string)}
              value={repositoryKey}
            >
              <SelectTrigger
                aria-label="Website repository"
                className="w-44 sm:w-56"
              >
                <SelectValue
                  className="block! truncate"
                  placeholder="Choose a repo"
                />
              </SelectTrigger>
              <SelectContent
                align="end"
                className="w-auto max-w-(--available-width) min-w-(--anchor-width)"
              >
                {repositories.map((repository) => (
                  <SelectItem
                    key={repository.fullName}
                    value={repository.fullName}
                  >
                    {repository.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              className="w-44 sm:w-56"
              loading={installing}
              onClick={installGitHub}
              size="sm"
              variant="secondary"
            >
              <HugeiconsIcon icon={Github01Icon} size={16} />
              Connect GitHub
            </Button>
          )}
        </SetupRow>
        <SetupRow
          icon={<HugeiconsIcon className="size-4" icon={SlackIcon} />}
          title="Slack channel"
        >
          {slackIntegration ? (
            <Select
              items={channels.map((channel) => ({
                value: channel.id,
                label: `#${channel.name}`,
              }))}
              onValueChange={(value) => setChannelId(value as string)}
              value={channelId}
            >
              <SelectTrigger
                aria-label="Slack channel"
                className="w-44 sm:w-56"
              >
                <SelectValue
                  className="block! truncate"
                  placeholder="Choose a channel"
                />
              </SelectTrigger>
              <SelectContent
                align="end"
                className="w-auto max-w-(--available-width) min-w-(--anchor-width)"
              >
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              className="w-44 sm:w-56"
              nativeButton={false}
              render={<a href={slackAuthorizeUrl} />}
              size="sm"
              variant="secondary"
            >
              <HugeiconsIcon icon={SlackIcon} size={16} />
              Connect Slack
            </Button>
          )}
        </SetupRow>
        {slackIntegration ? (
          <p className="text-muted-foreground px-4 pb-3 text-xs">
            {AUTOPILOT_SLACK_CHANNEL_HINT}
          </p>
        ) : null}
        <SetupRow
          icon={<HugeiconsIcon className="size-4" icon={Clock01Icon} />}
          title="Runs daily at"
        >
          <Select
            items={AUTOPILOT_HOUR_OPTIONS}
            onValueChange={(value) => setBriefHour(Number(value))}
            value={String(briefHour)}
          >
            <SelectTrigger
              aria-label={`Runs daily at, ${timezone}`}
              className="w-44 sm:w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTOPILOT_HOUR_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SetupRow>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={!canSave}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
