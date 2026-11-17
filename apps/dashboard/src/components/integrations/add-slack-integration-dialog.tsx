"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@notra/ui/components/shared/responsive-dialog";
import { Slack } from "@notra/ui/components/ui/svgs/slack";
import type React from "react";
import { isValidElement, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { INTEGRATION_PROVIDERS } from "@/constants/integration-analytics";
import { flushTrackEvent } from "@/lib/analytics/posthog-client";
import type { AddSlackIntegrationDialogProps } from "@/types/slack-integration";

const SLACK_DIALOG_FEATURES = [
  "chat",
  "approve",
  "mirror",
  "channels",
] as const;

export function AddSlackIntegrationDialog({
  authorizeUrl,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: AddSlackIntegrationDialogProps) {
  const t = useTranslations("integrations.slackDialog");
  const tIntegrationsShared = useTranslations("integrations.shared");
  const tCommon = useTranslations("common");
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const triggerElement = isValidElement(trigger) ? (
    <ResponsiveDialogTrigger render={trigger} />
  ) : null;

  return (
    <ResponsiveDialog onOpenChange={setOpen} open={open}>
      {triggerElement}
      <ResponsiveDialogContent className="sm:max-w-[440px]">
        <ResponsiveDialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <span
              aria-hidden="true"
              className="bg-background border-foreground/10 grid size-10 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_0_8px_rgba(255,255,255,0.08)]"
            >
              <Slack className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <ResponsiveDialogTitle>{t("title")}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {t("description")}
              </ResponsiveDialogDescription>
            </div>
          </div>
        </ResponsiveDialogHeader>
        <ul className="space-y-2">
          {SLACK_DIALOG_FEATURES.map((feature) => (
            <li className="flex items-start gap-2.5 text-sm" key={feature}>
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                icon={Tick02Icon}
              />
              {t(`features.${feature}`)}
            </li>
          ))}
        </ul>
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose render={<Button variant="outline" />}>
            {tCommon("actions.cancel")}
          </ResponsiveDialogClose>
          <Button
            data-dialog-confirm
            onClick={() => {
              void flushTrackEvent(POSTHOG_EVENTS.INTEGRATION_CONNECT_STARTED, {
                provider: INTEGRATION_PROVIDERS.SLACK,
              }).finally(() => {
                window.location.href = authorizeUrl;
              });
            }}
          >
            {tIntegrationsShared("addToSlack")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
