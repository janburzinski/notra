import { beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { call, ORPCError } from "@orpc/server";
import {
  hydrate,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import en from "../messages/en.json";

if (!process.env.NOTRA_WEB_ANALYTICS_FLAG_TEST_WORKER) {
  test("web analytics feature flag contract", () => {
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_WEB_ANALYTICS_FLAG_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  }, 35_000);
} else {
  let enabled = false;
  let member = true;
  const evaluations: string[] = [];
  const nodeSdk = await import("@databuddy/sdk/node");
  mock.module("@databuddy/sdk/node", () => ({
    ...nodeSdk,
    createServerFlagsManager: () => ({
      getFlag: async (key: string, context: { organizationId: string }) => {
        evaluations.push(`${key}:${context.organizationId}`);
        return { enabled, reason: "TARGETING" };
      },
    }),
  }));
  mock.module("../src/lib/auth/organization", () => ({
    assertAuthenticated: async () => ({ session: {}, user: { id: "user-1" } }),
    assertOrganizationAccess: async () => {
      if (!member) {
        throw new ORPCError("FORBIDDEN", { message: "Not a member" });
      }
      return {
        organizationId: "org-1",
        membership: { role: "owner" },
        user: { id: "user-1" },
      };
    },
  }));
  const organizationProvider =
    await import("../src/components/providers/organization-provider");
  mock.module("../src/components/providers/organization-provider", () => ({
    ...organizationProvider,
    useOrganizationsContext: () => ({
      activeOrganization: { id: "org-1", slug: "acme" },
    }),
  }));
  let serverQueryClient = new QueryClient();
  mock.module("../src/utils/geo-query-client.server", () => ({
    getGeoServerQueryClient: () => serverQueryClient,
  }));
  mock.module("../src/lib/auth/server", () => ({
    getAuthIdentity: async () => null,
  }));
  mock.module("../src/components/framework/link", () => ({ default: "a" }));
  mock.module("../src/lib/navigation", () => ({
    usePathname: () => "/acme/geo/traffic",
    useParams: () => ({ slug: "acme" }),
  }));
  mock.module("../src/lib/hooks/use-geo-project-query", () => ({
    useGeoProjectQueryState: () => [null],
  }));

  const { useNavVisibility } =
    await import("../src/lib/hooks/use-nav-visibility");
  const { useWebAnalyticsFlag } =
    await import("../src/lib/hooks/use-web-analytics-flag");
  const { AnalyticsSourceTabs } =
    await import("../src/components/analytics/analytics-source-tabs");
  const { commandRoutesForAI } = await import("../src/utils/command-palette");
  const { availableGeoIngestMethods } = await import("../src/utils/geo-ingest");
  const { getLogDestination } = await import("../src/utils/log-details");
  const { createORPCContext } = await import("../src/lib/orpc/context");
  const { dashboardOrpc } = await import("../src/lib/orpc/query");
  const { geoRouter } = await import("../src/lib/orpc/routers/geo");
  const { dehydrateOrganizationShellQueries } =
    await import("../src/utils/organization-shell-prefetch.server");
  const { analyticsImportsRouter } =
    await import("../src/lib/orpc/routers/analytics-imports");

  beforeEach(() => {
    enabled = false;
    member = true;
    serverQueryClient = new QueryClient();
    evaluations.length = 0;
    process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID = "synthetic-client";
    delete process.env.NEXT_PUBLIC_NOTRA_DEMO_MODE;
  });

  const flagKey = dashboardOrpc.geo.webAnalyticsEnabled.queryKey({
    input: { organizationId: "org-1" },
  });

  /** Renders like the browser's first paint: only seeded data, no fetches. */
  const renderWith = (node: ReactNode, flag?: boolean) => {
    const queryClient = new QueryClient();
    if (flag !== undefined) {
      queryClient.setQueryData(flagKey, flag);
    }
    return renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <IntlProvider locale="en" messages={en}>
          {node}
        </IntlProvider>
      </QueryClientProvider>
    );
  };

  const FlagProbe = () => {
    const { webAnalytics } = useNavVisibility();
    const { settled } = useWebAnalyticsFlag();
    return <span>{`${webAnalytics}:${settled}`}</span>;
  };

  test("client visibility reads the server's answer and waits for it", () => {
    expect(renderWith(<FlagProbe />, false)).toContain("false:true");
    expect(renderWith(<FlagProbe />, true)).toContain("true:true");
    expect(renderWith(<FlagProbe />)).toContain("false:false");
  });

  test("the analytics tabs wait for the flag, then show the web tab only with it", () => {
    expect(renderWith(<AnalyticsSourceTabs />)).not.toContain(
      "/acme/geo/traffic"
    );
    const off = renderWith(<AnalyticsSourceTabs />, false);
    expect(off).not.toContain("/acme/geo/traffic/web");
    expect(off).toContain(en.analytics.sources.website);
    expect(off).not.toContain(en.analytics.sources.agents);
    expect(renderWith(<AnalyticsSourceTabs />, true)).toContain(
      "/acme/geo/traffic/web"
    );
  });

  test("the organization shell seeds the server's flag for the first paint", async () => {
    enabled = true;
    const browser = new QueryClient();
    hydrate(
      browser,
      await dehydrateOrganizationShellQueries("org-1", new Headers(), undefined)
    );
    expect(browser.getQueryData(flagKey)).toBe(true);
  });

  test("the command palette, tracking setup and log links offer web analytics only with the flag", () => {
    const routes = (webAnalytics: boolean) =>
      commandRoutesForAI("acme", true, {
        autopilot: false,
        analytics: true,
        sites: true,
        webAnalytics,
      });
    const ids = (webAnalytics: boolean) =>
      routes(webAnalytics).map((route) => route.id);
    const trackingKeywords = (webAnalytics: boolean) =>
      routes(webAnalytics).find((route) => route.id === "geo-settings-tracking")
        ?.keywords ?? [];
    expect(ids(false)).toContain("geo-traffic");
    expect(ids(false)).not.toContain("geo-web-analytics");
    expect(ids(false)).not.toContain("geo-agent-analytics");
    expect(trackingKeywords(false)).not.toContain("script");
    expect(ids(true)).toContain("geo-web-analytics");
    expect(ids(true)).not.toContain("geo-traffic");
    expect(trackingKeywords(true)).toContain("script");

    expect(availableGeoIngestMethods(false)).not.toContain("script");
    expect(availableGeoIngestMethods(true)).toContain("script");

    expect(getLogDestination("search-console", "acme", false)?.href).toBe(
      "/acme/geo/traffic"
    );
    expect(getLogDestination("search-console", "acme", true)?.href).toBe(
      "/acme/geo/traffic/web"
    );
  });

  test("the flag and import RPCs check membership first, then ask the server", async () => {
    const newContext = () => createORPCContext({ headers: new Headers() });
    const readContext = await newContext();
    const read = () =>
      call(
        geoRouter.webAnalyticsEnabled,
        { organizationId: "org-1" },
        { context: readContext }
      );
    const upload = async () =>
      call(
        analyticsImportsRouter.uploadTarget,
        { organizationId: "org-1", fileSize: 1024 },
        { context: await newContext() }
      );
    member = false;
    await expect(read()).rejects.toThrow("Not a member");
    await expect(upload()).rejects.toThrow("Not a member");
    expect(evaluations).toEqual([]);
    member = true;
    await expect(upload()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: en.errors.webAnalytics.unavailable,
    });
    enabled = true;
    expect(await read()).toBe(true);
    expect(await read()).toBe(true);
    expect(evaluations).toEqual(["web-analytics:org-1", "web-analytics:org-1"]);
  });
}
