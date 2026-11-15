import { HydrationBoundary } from "@tanstack/react-query";
import {
  type AnyRoute,
  notFound,
  redirect,
  useParams,
} from "@tanstack/react-router";
import { Activity, Suspense, useState } from "react";

import ReadinessLoading from "@/app/(dashboard)/[slug]/geo/agent-readiness/loading";
import { GeoCompetitorsSkeleton as CompetitorsLoading } from "@/app/(dashboard)/[slug]/geo/competitors/skeleton";
import GapsLoading from "@/app/(dashboard)/[slug]/geo/gaps/loading";
import PersonasLoading from "@/app/(dashboard)/[slug]/geo/personas/loading";
import PromptsLoading from "@/app/(dashboard)/[slug]/geo/prompts/loading";
import ShelfLoading from "@/app/(dashboard)/[slug]/geo/shelf-space/loading";
import { GeoPageSkeleton } from "@/app/(dashboard)/[slug]/geo/skeleton";
import McpTrafficLoading from "@/app/(dashboard)/[slug]/geo/traffic/mcp/loading";
import { AiAnalyticsSkeleton } from "@/app/(dashboard)/[slug]/geo/traffic/skeleton";
import { WebAnalyticsSkeleton } from "@/app/(dashboard)/[slug]/geo/traffic/web/skeleton";
import type { GeoTrafficTab } from "@/types/geo-traffic-pages";
import type { UiPageProps, UiRouteTitle } from "@/types/ui-route";
import { geoCompetitorDetailPath } from "@/utils/geo-competitors";
import { withGeoProject } from "@/utils/geo-paths";
import { geoTrafficTab } from "@/utils/geo-traffic-tab";
import { lazyPage } from "@/utils/lazy-page";
import { geoSettingsPath } from "@/utils/settings-path";

import { gateGeoPage, loadGeoPage } from "./-dashboard-loaders";

/** Absent on client navigations: the traffic pages fetch their own data. */
type GeoTrafficPageData = Awaited<ReturnType<typeof loadGeoPage>> | undefined;

import { createUiRoute } from "./-ui-route";

const Overview = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/page-client")
);
const AiAnalytics = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/traffic/page-client")
);
const WebAnalytics = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/traffic/web/page-client")
);
const McpTraffic = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/traffic/mcp/page-client")
);
const Competitors = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/competitors/page-client")
);
const Readiness = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/agent-readiness/page-client")
);
const Directions = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/directions/page-client")
);
const Gaps = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/gaps/page-client")
);
const Personas = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/personas/page-client")
);
const Prompts = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/prompts/page-client")
);
const Shelf = lazyPage(
  () => import("@/app/(dashboard)/[slug]/geo/shelf-space/page-client")
);

const GEO_TRAFFIC_TAB_KINDS = {
  agents: "agent-analytics",
  web: "web-analytics",
} as const;

const GEO_TRAFFIC_TAB_TITLES: Record<GeoTrafficTab, UiRouteTitle> = {
  agents: { namespace: "geo.pages.aiAnalytics", key: "metaTitle" },
  web: { namespace: "geo.pages.webAnalytics", key: "metaTitle" },
  mcp: { namespace: "geo.pages.traffic", key: "mcpMetaTitle" },
};

const GEO_TRAFFIC_TAB_PAGES = {
  agents: { page: AiAnalytics, skeleton: AiAnalyticsSkeleton },
  web: { page: WebAnalytics, skeleton: WebAnalyticsSkeleton },
  mcp: { page: McpTraffic, skeleton: McpTrafficLoading },
} as const;

function TrafficTabPending() {
  const { tab } = useParams({ strict: false });
  const Skeleton =
    GEO_TRAFFIC_TAB_PAGES[geoTrafficTab(tab) ?? "agents"].skeleton;
  return <Skeleton />;
}

/**
 * Every tab opened stays mounted, hidden by Activity: switching back shows it
 * as it was, and a hidden tab's effects (its queries among them) pause.
 * Leaving `display: none` restarts CSS animations, so after the first switch
 * each revealed tab replays the fade on what differs between tabs.
 */
function TrafficTabPanels({ data, params }: UiPageProps<GeoTrafficPageData>) {
  const tab = geoTrafficTab(params.tab);
  const [opened, setOpened] = useState<readonly GeoTrafficTab[]>(() =>
    tab ? [tab] : []
  );
  if (tab && !opened.includes(tab)) {
    setOpened([...opened, tab]);
  }
  // The first page load doesn't fade; every switch after it does.
  const [shownTab, setShownTab] = useState(tab);
  const [fade, setFade] = useState(false);
  if (tab !== shownTab) {
    setShownTab(tab);
    setFade(true);
  }
  return (
    <HydrationBoundary state={data?.state}>
      {opened.map((name) => {
        const { page: Page, skeleton: Skeleton } = GEO_TRAFFIC_TAB_PAGES[name];
        return (
          <Activity key={name} mode={name === tab ? "visible" : "hidden"}>
            <div
              className="contents"
              data-traffic-tab-fade={fade ? "" : undefined}
            >
              <Suspense fallback={<Skeleton />}>
                <Page organizationSlug={params.slug} />
              </Suspense>
            </div>
          </Activity>
        );
      })}
    </HydrationBoundary>
  );
}

export function createGeoUiRoutes(parent: AnyRoute) {
  return [
    createUiRoute({
      parent,
      path: "/",
      title: { namespace: "common", key: "labels.geo" },
      pendingComponent: GeoPageSkeleton,
      loaderSearchKeys: ["project", "range"],
      loader: (input) => loadGeoPage({ data: { ...input, kind: "overview" } }),
      gate: (input) => gateGeoPage({ data: { ...input, kind: "overview" } }),
      stream: "ssr",
      preload: Overview.preload,
      component: ({ data, params }) => (
        <HydrationBoundary state={data.state}>
          <Overview organizationSlug={params.slug} />
        </HydrationBoundary>
      ),
    }),
    // One route for the Agent, Web and MCP tabs, so switching between them
    // keeps the route's component mounted and every opened tab with it.
    createUiRoute<GeoTrafficPageData>({
      parent,
      path: "traffic/{-$tab}",
      title: ({ tab }) =>
        GEO_TRAFFIC_TAB_TITLES[geoTrafficTab(tab) ?? "agents"],
      pendingComponent: TrafficTabPending,
      loaderSearchKeys: [],
      loader: (input) => {
        const tab = geoTrafficTab(input.params.tab);
        if (!tab) {
          throw notFound();
        }
        return tab === "mcp"
          ? Promise.resolve(undefined)
          : loadGeoPage({
              data: { ...input, kind: GEO_TRAFFIC_TAB_KINDS[tab] },
            });
      },
      gate: async (input) => {
        const tab = geoTrafficTab(input.params.tab);
        if (!tab) {
          throw notFound();
        }
        if (tab !== "mcp") {
          await gateGeoPage({
            data: { ...input, kind: GEO_TRAFFIC_TAB_KINDS[tab] },
          });
        }
      },
      stream: "ssr",
      // Switching between the analytics tabs never waits on the server.
      ssrDataOnly: true,
      preload: () =>
        Promise.all([
          AiAnalytics.preload(),
          WebAnalytics.preload(),
          McpTraffic.preload(),
        ]),
      component: TrafficTabPanels,
    }),
    createUiRoute({
      parent,
      path: "competitors",
      title: { namespace: "geo.pages.competitors", key: "metaTitle" },
      pendingComponent: CompetitorsLoading,
      preload: Competitors.preload,
      component: ({ params }) => <Competitors organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "competitors/$competitor",
      title: { namespace: "geo.shared", key: "competitor" },
      component: () => null,
      loader: async ({ params, searchParams }) => {
        throw redirect({
          href: withGeoProject(
            geoCompetitorDetailPath(params.slug ?? "", params.competitor ?? ""),
            typeof searchParams.project === "string"
              ? searchParams.project
              : undefined
          ),
        });
      },
    }),
    createUiRoute({
      parent,
      path: "agent-readiness",
      title: { namespace: "common", key: "labels.agentReadiness" },
      pendingComponent: ReadinessLoading,
      preload: Readiness.preload,
      component: ({ params }) => <Readiness organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "directions",
      title: { namespace: "geo.shared", key: "geoDirections" },
      pendingComponent: GeoPageSkeleton,
      preload: Directions.preload,
      component: () => <Directions />,
    }),
    createUiRoute({
      parent,
      path: "gaps",
      title: { namespace: "geo.pages.gaps", key: "metaTitle" },
      pendingComponent: GapsLoading,
      preload: Gaps.preload,
      component: ({ params }) => <Gaps organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "personas",
      title: { namespace: "geo.pages.personas", key: "metaTitle" },
      pendingComponent: PersonasLoading,
      preload: Personas.preload,
      component: ({ params }) => <Personas organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "prompts",
      title: { namespace: "geo.pages.prompts", key: "metaTitle" },
      pendingComponent: PromptsLoading,
      preload: Prompts.preload,
      component: ({ params }) => <Prompts organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "shelf-space",
      title: { namespace: "geo.pages.shelfSpace", key: "metaTitle" },
      pendingComponent: ShelfLoading,
      preload: Shelf.preload,
      component: ({ params }) => <Shelf organizationSlug={params.slug} />,
    }),
    createUiRoute({
      parent,
      path: "write",
      title: { namespace: "common", key: "labels.content" },
      component: () => null,
      loader: ({ params, searchParams }) => {
        throw redirect({
          href: withGeoProject(
            `/${params.slug ?? ""}/content`,
            typeof searchParams.project === "string"
              ? searchParams.project
              : undefined
          ),
        });
      },
    }),
    createUiRoute({
      parent,
      path: "settings",
      title: { namespace: "common", key: "labels.geoSettings" },
      component: () => null,
      loader: async ({ params, searchParams }) => {
        throw redirect({
          href: geoSettingsPath(params.slug ?? "", {
            project:
              typeof searchParams.project === "string"
                ? searchParams.project
                : undefined,
          }),
        });
      },
    }),
  ];
}
