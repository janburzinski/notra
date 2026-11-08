"use client";

import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import { useQuery } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import { readSiteAuthors } from "@/utils/site-authors";
import { parseDesignSource } from "@/utils/site-design-sections";

/**
 * The Sites site a blog post publishes to and the authors its blog.json
 * has, unpublished Design changes included. No site means Notra authors.
 */
export function usePostAuthorSite(organizationId: string, contentId: string) {
  const target = useQuery(
    dashboardOrpc.sites.authors.forPost.queryOptions({
      input: { organizationId, postId: contentId },
    })
  );
  const site = target.data?.site ?? null;
  const config = useQuery(
    dashboardOrpc.sites.editor.read.queryOptions({
      input: {
        organizationId,
        siteId: site?.id ?? "",
        path: SITE_CONFIG_FILENAME,
      },
      enabled: Boolean(site),
      refetchOnWindowFocus: true,
    })
  );
  return {
    site,
    authors: config.data
      ? readSiteAuthors(parseDesignSource(config.data.content))
      : [],
    loading: target.isPending || (Boolean(site) && config.isPending),
    failed: config.isError,
  };
}
