import type { QueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteScope } from "@/types/sites";

export async function invalidateSiteBranch(
  client: QueryClient,
  scope: SiteScope
) {
  const input = { organizationId: scope.organizationId, siteId: scope.siteId };
  await Promise.all([
    client.invalidateQueries({
      refetchType: "all",
      queryKey: dashboardOrpc.sites.get.key({ input }),
    }),
    client.invalidateQueries({
      refetchType: "all",
      queryKey: dashboardOrpc.sites.branches.list.key({
        input,
      }),
    }),
    client.invalidateQueries({
      refetchType: "all",
      queryKey: dashboardOrpc.sites.editor.files.key({ input }),
    }),
    client.invalidateQueries({
      refetchType: "all",
      queryKey: dashboardOrpc.sites.editor.read.key({ input }),
    }),
    client.invalidateQueries({
      refetchType: "all",
      queryKey: dashboardOrpc.sites.editor.validate.key({ input }),
    }),
    client.invalidateQueries({
      refetchType: "all",
      queryKey: dashboardOrpc.sites.branches.status.key({ input }),
    }),
  ]);
}
