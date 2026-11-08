import { runWithGeoRequestMemo } from "@notra/geo-core/utils/request-memo";
import { createRouterClient } from "@orpc/server";
import { dehydrate } from "@tanstack/react-query";

import { assertOrganizationAccess } from "@/lib/auth/organization";
import { createORPCContext } from "@/lib/orpc/context";
import { dashboardOrpc } from "@/lib/orpc/query";
import { geoRouter } from "@/lib/orpc/routers/geo";
import { isWebAnalyticsEnabled } from "@/lib/web-analytics/flag";
import type { GeoTrafficPageKind } from "@/types/geo-traffic-pages";
import {
  geoHydrationInputs,
  geoTrafficHydrationInputs,
} from "@/utils/geo-hydration";
import { getGeoServerQueryClient } from "@/utils/geo-query-client.server";

/**
 * Starts the GEO overview queries on the server and returns the dehydrated
 * cache. The queries are intentionally not awaited: the query client dehydrates
 * pending queries, so the shell streams while they resolve.
 */
export function dehydrateGeoOverviewQueries(
  ...args: Parameters<typeof dehydrateGeoOverview>
) {
  return runWithGeoRequestMemo(() => dehydrateGeoOverview(...args));
}

async function dehydrateGeoOverview(
  organizationId: string,
  projectId: string | undefined,
  search: Record<string, string | string[] | undefined>,
  requestHeaders: Headers
) {
  await createORPCContext({ headers: requestHeaders });
  await assertOrganizationAccess({ organizationId, headers: requestHeaders });
  const input = geoHydrationInputs(organizationId, projectId, search);
  const client = createRouterClient(
    { geo: geoRouter },
    { context: () => createORPCContext({ headers: requestHeaders }) }
  );
  const queryClient = getGeoServerQueryClient();

  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.settings.queryOptions({ input: input.settings }),
    queryFn: () => client.geo.settings(input.settings),
  });
  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.overview.queryOptions({ input: input.overview }),
    queryFn: () => client.geo.overview(input.overview),
  });
  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.timeseries.queryOptions({ input: input.timeseries }),
    queryFn: () => client.geo.timeseries(input.timeseries),
  });
  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.promptsList.queryOptions({ input: input.prompts }),
    queryFn: () => client.geo.promptsList(input.prompts),
  });
  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.competitors.queryOptions({ input: input.competitors }),
    queryFn: () => client.geo.competitors(input.competitors),
  });

  if (input.activeTab === "journeys") {
    void queryClient.prefetchQuery({
      ...dashboardOrpc.geo.trafficJourneys.queryOptions({
        input: input.trafficJourneys,
      }),
      queryFn: () => client.geo.trafficJourneys(input.trafficJourneys),
    });
    void queryClient.prefetchQuery({
      ...dashboardOrpc.geo.journeyStats.queryOptions({
        input: input.journeyStats,
      }),
      queryFn: () => client.geo.journeyStats(input.journeyStats),
    });
  }
  if (input.activeTab === "visibility") {
    void queryClient.prefetchQuery({
      ...dashboardOrpc.geo.promptResultSummaries.queryOptions({
        input: input.promptResultSummaries,
      }),
      queryFn: () =>
        client.geo.promptResultSummaries(input.promptResultSummaries),
    });
  }
  if (input.activeTab === "visibility") {
    void queryClient.prefetchQuery({
      ...dashboardOrpc.geo.competitorShare.queryOptions({
        input: input.competitorShare,
      }),
      queryFn: () => client.geo.competitorShare(input.competitorShare),
    });
    void queryClient.prefetchQuery({
      ...dashboardOrpc.geo.languageShare.queryOptions({
        input: input.languageShare,
      }),
      queryFn: () => client.geo.languageShare(input.languageShare),
    });
  }

  return dehydrate(queryClient);
}

/**
 * Prefetch for the AI and web analytics pages, limited to what the first
 * paint needs: settings, the AI traffic summary, the ingest setup and, on web
 * analytics or without the web analytics flag, the web summary. The streamed
 * document stays open until every dehydrated query settles and hydration
 * waits for it, so the slower tables (top pages, log, per-source page counts,
 * web breakdowns) load from the client instead.
 */
export function dehydrateGeoTrafficQueries(
  ...args: Parameters<typeof dehydrateGeoTraffic>
) {
  return runWithGeoRequestMemo(() => dehydrateGeoTraffic(...args));
}

async function dehydrateGeoTraffic(
  page: GeoTrafficPageKind,
  organizationId: string,
  projectId: string | undefined,
  search: Record<string, string | string[] | undefined>,
  requestHeaders: Headers
) {
  await createORPCContext({ headers: requestHeaders });
  await assertOrganizationAccess({ organizationId, headers: requestHeaders });
  const input = geoTrafficHydrationInputs(organizationId, projectId, search);
  const client = createRouterClient(
    { geo: geoRouter },
    { context: () => createORPCContext({ headers: requestHeaders }) }
  );
  const queryClient = getGeoServerQueryClient();

  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.settings.queryOptions({ input: input.settings }),
    queryFn: () => client.geo.settings(input.settings),
  });
  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.aiTraffic.queryOptions({ input: input.aiTraffic }),
    queryFn: () => client.geo.aiTraffic(input.aiTraffic),
  });
  void queryClient.prefetchQuery({
    ...dashboardOrpc.geo.ingestSetup.queryOptions({ input: input.ingestSetup }),
    queryFn: () => client.geo.ingestSetup(input.ingestSetup),
  });
  // Without web analytics the AI analytics page shows people too.
  if (
    page === "web-analytics" ||
    !(await isWebAnalyticsEnabled(organizationId, requestHeaders))
  ) {
    void queryClient.prefetchQuery({
      ...dashboardOrpc.geo.webAnalytics.queryOptions({
        input: input.webAnalytics,
      }),
      queryFn: () => client.geo.webAnalytics(input.webAnalytics),
    });
  }

  return dehydrate(queryClient);
}
