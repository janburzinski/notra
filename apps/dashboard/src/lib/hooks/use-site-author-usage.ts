"use client";

import { useQuery } from "@tanstack/react-query";

import { useSite } from "@/components/sites/site-context";
import { dashboardOrpc } from "@/lib/orpc/query";

/** How many Notra posts name each blog.json author; null while unknown. */
export function useSiteAuthorUsage() {
  const { organizationId, siteId } = useSite();
  const query = useQuery(
    dashboardOrpc.sites.authors.usage.queryOptions({
      input: { organizationId, siteId },
    })
  );
  return (id: string): number | null =>
    query.isSuccess ? (query.data.posts[id] ?? 0) : null;
}
