"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Github } from "@notra/ui/components/ui/svgs/github";
import { cn } from "@notra/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { CONTENT_PULL_REQUEST_STATES } from "@/constants/content-overview";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentPullRequestButtonProps } from "@/types/components/content-detail-toolbar";

/** Links to the content's pull request and shows its live GitHub state. */
export function ContentPullRequestButton({
  contentId,
  githubPublish,
  organizationId,
}: ContentPullRequestButtonProps) {
  const t = useTranslations("content.header");
  const { data } = useQuery({
    ...dashboardOrpc.content.pullRequestState.queryOptions({
      input: { organizationId, contentId },
    }),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const status = data?.status ?? null;
  const state = status ? CONTENT_PULL_REQUEST_STATES[status] : null;

  return (
    <Button
      className="min-w-0"
      nativeButton={false}
      render={
        <a
          href={githubPublish.pullRequestUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {status && state ? (
            <>
              <HugeiconsIcon
                aria-hidden="true"
                className={cn("size-4", state.className)}
                icon={state.icon}
              />
              <span className="min-w-0 truncate">
                {t(`pullRequestState.${status}`)}
              </span>
              <span className="text-muted-foreground tabular-nums">
                #{githubPublish.pullRequestNumber}
              </span>
            </>
          ) : (
            <>
              <Github aria-hidden="true" />
              <span className="min-w-0 truncate">{t("openPullRequest")}</span>
            </>
          )}
        </a>
      }
      size="sm"
      title={t("openPullRequest")}
      variant="outline"
    />
  );
}
