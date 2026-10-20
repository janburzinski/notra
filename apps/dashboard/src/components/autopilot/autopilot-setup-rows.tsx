"use client";

import { Clock01Icon, SlackIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";

import { AUTOPILOT_HOUR_OPTIONS } from "@/constants/autopilot";
import { AUTOPILOT_SLACK_CHANNEL_HINT } from "@/constants/autopilot-slack";
import type {
  AutopilotSetupRowProps,
  AutopilotSetupRowsProps,
} from "@/types/autopilot";

const CONTROL_CLASS = "w-44 sm:w-56";

function SetupRow({
  icon,
  title,
  description,
  children,
}: AutopilotSetupRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          {description ? (
            <p className="text-muted-foreground text-xs text-pretty">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

export function AutopilotSlackRow({ setup }: AutopilotSetupRowsProps) {
  const { slackIntegration, channels } = setup;
  return (
    <SetupRow
      description={slackIntegration ? AUTOPILOT_SLACK_CHANNEL_HINT : undefined}
      icon={<HugeiconsIcon className="size-4" icon={SlackIcon} />}
      title="Slack channel"
    >
      {slackIntegration ? (
        <Select
          items={channels.map((channel) => ({
            value: channel.id,
            label: `#${channel.name}`,
          }))}
          onValueChange={(value) => setup.setChannelId(value as string)}
          value={setup.channelId}
        >
          <SelectTrigger aria-label="Slack channel" className={CONTROL_CLASS}>
            <SelectValue
              className="block! truncate"
              placeholder="Choose a channel"
            />
          </SelectTrigger>
          <SelectContent
            align="end"
            className="max-h-72 w-auto max-w-(--available-width) min-w-(--anchor-width)"
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
          className={CONTROL_CLASS}
          nativeButton={false}
          render={
            <a aria-label="Connect Slack" href={setup.slackAuthorizeUrl} />
          }
          size="sm"
          variant="secondary"
        >
          <HugeiconsIcon icon={SlackIcon} size={16} />
          Connect Slack
        </Button>
      )}
    </SetupRow>
  );
}

export function AutopilotScheduleRow({ setup }: AutopilotSetupRowsProps) {
  return (
    <SetupRow
      description={setup.timezone}
      icon={<HugeiconsIcon className="size-4" icon={Clock01Icon} />}
      title="Runs daily at"
    >
      <Select
        items={AUTOPILOT_HOUR_OPTIONS}
        onValueChange={(value) => setup.setBriefHour(Number(value))}
        value={String(setup.briefHour)}
      >
        <SelectTrigger
          aria-label={`Runs daily at, ${setup.timezone}`}
          className={CONTROL_CLASS}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {AUTOPILOT_HOUR_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SetupRow>
  );
}
