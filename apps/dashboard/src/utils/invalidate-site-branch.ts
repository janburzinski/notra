import type { QueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { SiteScope } from "@/types/sites";

export async function invalidateSiteBranch(
  client: QueryClient,
  scope: SiteScope
) {
  await Promise.all([
    client.invalidateQueries({
      queryKey: dashboardOrpc.sites.branches.list.key({
        input: { organizationId: scope.organizationId, siteId: scope.siteId },
      }),
    }),
    client.invalidateQueries({
      queryKey: dashboardOrpc.sites.editor.files.key({ input: scope }),
    }),
    client.invalidateQueries({
      queryKey: dashboardOrpc.sites.editor.read.key({ input: scope }),
    }),
    client.invalidateQueries({
      queryKey: dashboardOrpc.sites.editor.validate.key({ input: scope }),
    }),
    client.invalidateQueries({
      queryKey: dashboardOrpc.sites.branches.status.key({ input: scope }),
    }),
  ]);
}
