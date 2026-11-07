"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import type { SiteIntegrationPullRequestStatusProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";

export function SiteIntegrationPullRequestStatus({
  result,
  error,
}: SiteIntegrationPullRequestStatusProps) {
  const t = useTranslations("sites.integrationsPage");
  const visible = Boolean(error || result);

  return (
    <div
      aria-live="polite"
      className={visible ? "shrink-0 space-y-0.5 text-sm" : "sr-only"}
      role="status"
    >
      {error ? (
        <p className="text-destructive">
          {toErrorMessage(error, t("saveFailed"))}
        </p>
      ) : null}
      {!error && result?.pullRequestUrl ? (
        <>
          <p className="font-medium">{t("pullRequestOpened")}</p>
          <p className="text-muted-foreground">
            {t("pullRequestOpenedDescription")}{" "}
            <a
              className="text-foreground inline-flex items-center gap-1 font-medium hover:underline"
              href={result.pullRequestUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("viewPullRequest")}
              <HugeiconsIcon
                aria-hidden="true"
                icon={ArrowUpRight01Icon}
                size={12}
              />
            </a>
          </p>
        </>
      ) : null}
      {!error && result && !result.pullRequestUrl ? (
        <p className="text-muted-foreground">{t("alreadySaved")}</p>
      ) : null}
    </div>
  );
}
