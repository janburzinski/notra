import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSite } from "@/components/sites/site-context";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteEditorDocument } from "@/types/sites";

export function useSiteConfigDocument() {
  const { organizationId, siteId } = useSite();
  return useQuery(
    dashboardOrpc.sites.editor.read.queryOptions({
      input: { organizationId, siteId, path: SITE_CONFIG_FILENAME },
      refetchOnWindowFocus: false,
    })
  );
}

/** Saves a new blog.json as an editor draft; publishing stays in the editor. */
export function useSaveSiteConfigDraft(document: SiteEditorDocument) {
  const { organizationId, siteId } = useSite();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      dashboardOrpc.sites.editor.saveDraft.call({
        organizationId,
        siteId,
        path: SITE_CONFIG_FILENAME,
        content,
        baseBlobSha: document.blobSha,
        baseCommitSha: null,
        draftId: document.draftId,
        draftRevision: document.draftRevision,
        sourceContext: document.sourceContext,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.editor.read.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.editor.files.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.sites.get.key(),
        }),
      ]),
  });
}
