import { createRouterClient } from "@orpc/server";
import { dehydrate } from "@tanstack/react-query";

import { WEB_ANALYTICS_SSR_FLAG_BUDGET_MS } from "@/constants/web-analytics";
import { getAuthIdentity } from "@/lib/auth/server";
import { geoDbQueryKey } from "@/lib/db/geo-collections";
import { syncLocaleCookie } from "@/lib/i18n/locale-cookie";
import { createORPCContext } from "@/lib/orpc/context";
import { dashboardOrpc } from "@/lib/orpc/query";
import { isWebAnalyticsEnabled } from "@/lib/web-analytics/flag";
import type { LoadedMembership } from "@/types/auth/organization";
import { toClientSessionData } from "@/utils/client-session";
import { getGeoServerQueryClient } from "@/utils/geo-query-client.server";
import { QUERY_KEYS } from "@/utils/query-keys";
import { seedMembership } from "@/utils/seed-membership.server";
import { settleWithin } from "@/utils/settle-within";

/**
 * Seeds what the sidebar needs on every dashboard page, the signed-in user
 * and the organization's projects, so both menus are in the server HTML
 * instead of showing skeletons until the browser fetches them. The server's
 * web analytics flag is seeded when it answers within a short budget, so the
 * first paint usually shows the right analytics tabs and tracking methods;
 * otherwise the browser asks and those areas show their loading state.
 */
export async function dehydrateOrganizationShellQueries(
  organizationId: string,
  requestHeaders: Headers,
  membership: LoadedMembership | undefined
) {
  const organizationInput = { organizationId };
  const [identity, webAnalyticsEnabled] = await Promise.all([
    getAuthIdentity(),
    settleWithin(
      isWebAnalyticsEnabled(organizationId, requestHeaders),
      WEB_ANALYTICS_SSR_FLAG_BUDGET_MS
    ),
    seedMembership(organizationId, requestHeaders, membership),
  ]);
  const queryClient = getGeoServerQueryClient();
  if (webAnalyticsEnabled !== undefined) {
    queryClient.setQueryData(
      dashboardOrpc.geo.webAnalyticsEnabled.queryKey({
        input: organizationInput,
      }),
      webAnalyticsEnabled
    );
  }
  if (identity) {
    // `/api/session` normally does this; seeding the session skips that call.
    await syncLocaleCookie(identity.user.locale);
    queryClient.setQueryData(
      QUERY_KEYS.AUTH.session,
      toClientSessionData(
        {
          userId: identity.user.id,
          activeOrganizationId: organizationId,
          impersonatedBy: identity.impersonatedBy,
        },
        identity.user
      )
    );
  }

  // Streamed, not awaited: the geo router is a large module, so loading it
  // inside the query keeps it off the time to first byte on cold starts.
  void queryClient.prefetchQuery({
    queryKey: geoDbQueryKey("projects", organizationInput),
    queryFn: async () => {
      const { geoRouter } = await import("@/lib/orpc/routers/geo");
      const client = createRouterClient(
        { geo: geoRouter },
        { context: () => createORPCContext({ headers: requestHeaders }) }
      );
      return (await client.geo.projectsList(organizationInput)).projects;
    },
  });
  return dehydrate(queryClient);
}
