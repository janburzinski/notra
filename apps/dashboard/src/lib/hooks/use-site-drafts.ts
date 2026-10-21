import { useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDraftResult } from "@/types/site-drafts";
import type { SiteScope } from "@/types/sites";

export function useSiteDrafts(scope: SiteScope) {
  const client = useQueryClient();
  const options = dashboardOrpc.sites.editor.files.queryOptions({
    input: scope,
    refetchOnWindowFocus: false,
  });
  const query = useQuery(options);
  const applyDraftChange = (
    path: string,
    updatedAt: Date | null,
    draft: SiteDraftResult | null
  ) => {
    client.setQueryData(options.queryKey, (current) => {
      if (!current) {
        return current;
      }
      const others = current.drafts.filter((item) => item.path !== path);
      if (!updatedAt || !draft) {
        return { ...current, drafts: others };
      }
      const existing = current.drafts.find((item) => item.path === path);
      const source = current.files.find((item) => item.path === path);
      return {
        ...current,
        drafts: [
          ...others,
          {
            path,
            id: draft.draftId,
            revision: draft.draftRevision,
            deleted: false,
            baseBlobSha: existing?.baseBlobSha ?? source?.sha ?? null,
            updatedAt,
          },
        ],
      };
    });
    void Promise.all([
      client.invalidateQueries({
        queryKey: dashboardOrpc.sites.editor.validate.key(),
      }),
      client.invalidateQueries({ queryKey: dashboardOrpc.sites.get.key() }),
    ]);
  };
  return { query, applyDraftChange };
}
