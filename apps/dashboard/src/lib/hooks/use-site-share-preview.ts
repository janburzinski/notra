import { useDebouncedValue } from "@tanstack/react-pacer";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useSite } from "@/components/sites/site-context";
import { useSiteWorkspace } from "@/components/sites/site-workspace-context";
import { SITE_SHARE_PREVIEW_DEBOUNCE_MS } from "@/constants/site-share-image";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteDesignForm } from "@/types/site-design";
import type { SiteSharePreviewPage } from "@/types/site-share-image";
import { sharePreviewConfig, sharePreviewVersion } from "@/utils/site-design";

/** The share image the next build draws for a page, rendered on the server. */
export function useSiteSharePreview(
  form: SiteDesignForm,
  page: SiteSharePreviewPage
) {
  const { organizationId, siteId } = useSite();
  const workspace = useSiteWorkspace();
  const [config] = useDebouncedValue(
    workspace ? sharePreviewConfig(workspace.config) : "",
    { wait: SITE_SHARE_PREVIEW_DEBOUNCE_MS }
  );
  const homeImage = page === "home" && form.shareImage.trim() !== "";
  const shown = form.thumbnailsEnabled || homeImage;
  const query = useQuery(
    dashboardOrpc.sites.editor.sharePreview.queryOptions({
      input: {
        organizationId,
        siteId,
        branch: workspace?.scope.branch,
        config,
        page,
        version: workspace ? sharePreviewVersion(workspace.files) : undefined,
      },
      enabled: shown && config !== "",
      placeholderData: keepPreviousData,
      staleTime: Number.POSITIVE_INFINITY,
      retry: 1,
    })
  );
  return { query, shown, homeImage };
}
