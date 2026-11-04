"use client";

import { Cancel01Icon, Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import type { GitHubInstallRequestedNoticeProps } from "@/types/integrations/github";

/** Shown after a GitHub org member who is not an owner requests the app. */
export function GitHubInstallRequestedNotice({
  onDismiss,
  className,
}: GitHubInstallRequestedNoticeProps) {
  const t = useTranslations("integrations.github.installRequested");
  return (
    <Alert className={className} role="status" variant="info">
      <HugeiconsIcon aria-hidden="true" icon={Clock01Icon} />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("description")}</AlertDescription>
      <AlertAction>
        <Button
          aria-label={t("dismiss")}
          onClick={onDismiss}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon aria-hidden="true" icon={Cancel01Icon} />
        </Button>
      </AlertAction>
    </Alert>
  );
}
