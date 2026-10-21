import { parseDiffFromFile } from "@pierre/diffs";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useSiteCodeHighlighter } from "@/lib/hooks/use-site-code-highlighter";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SitePublishChangeProps } from "@/types/components/site-publish";
import { diffLineCounts } from "@/utils/site-drafts";
export function useSitePublishDiff({
  organizationId,
  siteId,
  branch,
  path,
  change,
}: SitePublishChangeProps) {
  const readQuery = useQuery(
    dashboardOrpc.sites.editor.read.queryOptions({
      input: { organizationId, siteId, branch, path },
      refetchOnWindowFocus: false,
    })
  );
  const highlighterReady = useSiteCodeHighlighter();
  const document = readQuery.data ?? null;
  const before = change === "added" ? null : (document?.published ?? null);
  const after = change === "deleted" ? null : (document?.content ?? null);
  const fileDiff = useMemo(() => {
    if (!document) {
      return null;
    }
    return parseDiffFromFile(
      before === null ? null : { name: path, contents: before },
      after === null ? null : { name: path, contents: after }
    );
  }, [document, before, after, path]);
  const counts = fileDiff ? diffLineCounts(fileDiff) : null;

  return { readQuery, highlighterReady, fileDiff, counts };
}
