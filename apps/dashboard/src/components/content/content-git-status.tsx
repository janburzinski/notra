import { Badge } from "@notra/ui/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentGitStatusProps } from "@/types/content/git-publishing";

export function ContentGitStatus({
  organizationId,
  contentId,
  githubPublish,
}: ContentGitStatusProps) {
  const t = useTranslations("content.gitPublishing");
  const header = useTranslations("content.header");
  const { data } = useQuery({
    ...dashboardOrpc.content.pullRequestState.queryOptions({
      input: { organizationId, contentId },
    }),
    refetchInterval: 10_000,
  });
  const live = githubPublish.direct || data?.status === "merged";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {live ? (
        <Badge variant="success">
          {t("live", {
            target:
              data?.siteName ??
              githubPublish.baseBranch ??
              githubPublish.branchName,
          })}
        </Badge>
      ) : null}
      {githubPublish.pullRequestUrl ? (
        <a
          className="text-muted-foreground underline underline-offset-4"
          href={githubPublish.pullRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {data?.status
            ? header(`pullRequestState.${data.status}`)
            : `#${githubPublish.pullRequestNumber}`}
        </a>
      ) : null}
      {data?.previewUrl ? (
        <a
          className="underline underline-offset-4"
          href={data.previewUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("preview")}
        </a>
      ) : null}
    </div>
  );
}
