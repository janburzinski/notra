import { createRoute } from "@hono/zod-openapi";
import { listAnalyticsImportSummaries } from "@notra/geo-core/geo/analytics-imports";
import { loadGeoJourneyStats } from "@notra/geo-core/geo/programs";
import {
  loadWebAnalytics,
  loadWebUtm,
} from "@notra/geo-core/geo/web-analytics";
import { geoWindow } from "@notra/geo-core/geo/window";
import type { WebAnalyticsResponse } from "@notra/geo-core/types/geo";
import { projectParamsSchema } from "@notra/schemas/api/geo-params";
import {
  analyticsFilterQuerySchema,
  analyticsImportsResponseSchema,
  analyticsWindowQuerySchema,
  journeyStatsResponseSchema,
  webAnalyticsBreakdownsResponseSchema,
  webAnalyticsResponseSchema,
  webAnalyticsUtmQuerySchema,
  webAnalyticsUtmResponseSchema,
} from "@notra/schemas/api/geo-web-analytics";

import {
  GEO_COMMON_ERROR_RESPONSES,
  GEO_OPENAPI_TAG,
} from "../constants/geo-openapi";
import { runGeoEffect } from "../runtime/geo";
import { geoOutcomeResponse } from "../utils/geo";
import { createOpenApiApp } from "../utils/openapi-app";

/**
 * Website analytics (notra.js page views and outbound clicks), journey
 * statistics and history import status. The same loaders as the dashboard's
 * Analytics tab answer them, so numbers match. Response bodies are parsed
 * through their schemas: fields the API does not document never leak out.
 * Workspaces without the web analytics flag get 403 from every route here.
 */
export const geoWebAnalyticsRoutes = createOpenApiApp();

const webAnalyticsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/traffic/web",
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoWebAnalytics",
  summary: "Get website analytics totals and trend",
  description:
    "Page views, visitors, sessions and AI-referred visitors against the previous window of the same length, daily views and visitors, and the hosts seen. Includes completed history imports. Explicit ranges can span at most 366 days.",
  request: { params: projectParamsSchema, query: analyticsFilterQuerySchema },
  responses: {
    200: {
      description: "Web analytics fetched successfully",
      content: { "application/json": { schema: webAnalyticsResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const webBreakdownsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/traffic/web/breakdowns",
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoWebAnalyticsBreakdowns",
  summary: "Get website analytics breakdowns",
  description:
    "Top pages, referrer sources, countries, devices, languages, AI visitor outcomes, and the reports only notra.js sends: outbound link clicks, Core Web Vitals and JavaScript errors.",
  request: { params: projectParamsSchema, query: analyticsFilterQuerySchema },
  responses: {
    200: {
      description: "Web analytics breakdowns fetched successfully",
      content: {
        "application/json": { schema: webAnalyticsBreakdownsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const webUtmRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/traffic/web/utm",
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoWebAnalyticsUtm",
  summary: "Get website sessions by UTM parameter",
  description:
    "Sessions and visitors per value of one UTM parameter (source, medium, campaign, term or content), counted on each session's first page, against the previous window of the same length. Returns the top 25 values. Includes completed history imports when no path is set. Term and content from visits Notra tracked itself cover at most the last 90 days. Campaign, term and content values that look like an email address, a UUID or a token are reported as `:id`.",
  request: { params: projectParamsSchema, query: webAnalyticsUtmQuerySchema },
  responses: {
    200: {
      description: "UTM report fetched successfully",
      content: {
        "application/json": { schema: webAnalyticsUtmResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const journeyStatsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/traffic/journey-stats",
  tags: [GEO_OPENAPI_TAG],
  operationId: "getGeoTrafficJourneyStats",
  summary: "Get AI journey statistics",
  description:
    "Exact journey counts per AI source and per page against the previous window: single fetches, deep crawls, entry pages and daily counts.",
  request: { params: projectParamsSchema, query: analyticsWindowQuerySchema },
  responses: {
    200: {
      description: "Journey statistics fetched successfully",
      content: { "application/json": { schema: journeyStatsResponseSchema } },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const importsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/geo/traffic/imports",
  tags: [GEO_OPENAPI_TAG],
  operationId: "listGeoAnalyticsImports",
  summary: "List history imports",
  description:
    "Imports of earlier analytics from Plausible, Cloudflare or Vercel and their progress, newest first. Connections and their credentials are never returned; start imports in the dashboard.",
  request: { params: projectParamsSchema },
  responses: {
    200: {
      description: "Imports fetched successfully",
      content: {
        "application/json": { schema: analyticsImportsResponseSchema },
      },
    },
    ...GEO_COMMON_ERROR_RESPONSES,
  },
});

const webAnalyticsBodySchema = webAnalyticsResponseSchema.omit({
  organization: true,
});
const webBreakdownsBodySchema = webAnalyticsBreakdownsResponseSchema.omit({
  organization: true,
});
const webUtmBodySchema = webAnalyticsUtmResponseSchema.omit({
  organization: true,
});
const journeyStatsBodySchema = journeyStatsResponseSchema.omit({
  organization: true,
});
const importsBodySchema = analyticsImportsResponseSchema.omit({
  organization: true,
});

function toBreakdownsBody({ script, ...web }: WebAnalyticsResponse) {
  return webBreakdownsBodySchema.parse({
    ...web,
    outboundLinks: script?.outboundLinks ?? [],
    vitals: script?.vitals ?? [],
    errors: script?.errors ?? [],
    languages: script?.languages ?? [],
  });
}

geoWebAnalyticsRoutes.openapi(webAnalyticsRoute, async (c) => {
  const { organizationId } = c.get("geo");
  const { projectId } = c.req.valid("param");
  const query = c.req.valid("query");

  const outcome = await runGeoEffect(
    "webAnalytics",
    loadWebAnalytics(
      { organizationId, projectId },
      geoWindow(query),
      query.host,
      query.path,
      query.sites,
      "summary"
    )
  );
  return geoOutcomeResponse(c, outcome, 200, (value) =>
    webAnalyticsBodySchema.parse(value)
  );
});

geoWebAnalyticsRoutes.openapi(webBreakdownsRoute, async (c) => {
  const { organizationId } = c.get("geo");
  const { projectId } = c.req.valid("param");
  const query = c.req.valid("query");

  const outcome = await runGeoEffect(
    "webAnalyticsBreakdowns",
    loadWebAnalytics(
      { organizationId, projectId },
      geoWindow(query),
      query.host,
      query.path,
      query.sites,
      "breakdowns",
      { scriptReports: true }
    )
  );
  return geoOutcomeResponse(c, outcome, 200, toBreakdownsBody);
});

geoWebAnalyticsRoutes.openapi(webUtmRoute, async (c) => {
  const { organizationId } = c.get("geo");
  const { projectId } = c.req.valid("param");
  const query = c.req.valid("query");

  const outcome = await runGeoEffect(
    "webAnalyticsUtm",
    loadWebUtm(
      { organizationId, projectId },
      geoWindow(query),
      query.host,
      query.path ?? "",
      query.sites,
      query.dimension
    )
  );
  return geoOutcomeResponse(c, outcome, 200, (rows) =>
    webUtmBodySchema.parse({ dimension: query.dimension, rows })
  );
});

geoWebAnalyticsRoutes.openapi(journeyStatsRoute, async (c) => {
  const { organizationId } = c.get("geo");
  const { projectId } = c.req.valid("param");

  const outcome = await runGeoEffect(
    "journeyStats",
    loadGeoJourneyStats(
      { organizationId, projectId },
      geoWindow(c.req.valid("query"))
    )
  );
  return geoOutcomeResponse(c, outcome, 200, (value) =>
    journeyStatsBodySchema.parse(value)
  );
});

geoWebAnalyticsRoutes.openapi(importsRoute, async (c) => {
  const { organizationId } = c.get("geo");
  const { projectId } = c.req.valid("param");

  const outcome = await runGeoEffect(
    "analyticsImports",
    listAnalyticsImportSummaries(organizationId, projectId)
  );
  return geoOutcomeResponse(c, outcome, 200, (imports) =>
    importsBodySchema.parse({ imports })
  );
});
