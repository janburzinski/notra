import { expect, test } from "bun:test";

import {
  WEB_ANALYTICS_BETA_NOTE,
  WEB_ANALYTICS_BETA_SUMMARY_SUFFIX,
} from "../src/constants/web-analytics";
import {
  isWebAnalyticsPath,
  markWebAnalyticsBeta,
} from "../src/utils/openapi-web-analytics";

test("matches the paths the web analytics middleware gates", () => {
  expect(isWebAnalyticsPath("/v1/projects/{projectId}/geo/traffic/web")).toBe(
    true
  );
  expect(
    isWebAnalyticsPath("/v1/projects/{projectId}/geo/traffic/web/breakdowns")
  ).toBe(true);
  expect(
    isWebAnalyticsPath("/v1/projects/{projectId}/geo/traffic/imports")
  ).toBe(true);
  expect(
    isWebAnalyticsPath("/v1/projects/{projectId}/geo/traffic/journey-stats")
  ).toBe(true);
  expect(
    isWebAnalyticsPath("/v1/projects/{projectId}/geo/traffic/journeys")
  ).toBe(false);
  expect(
    isWebAnalyticsPath("/v1/projects/{projectId}/geo/traffic/website")
  ).toBe(false);
});

test("labels gated operations as private beta and leaves the rest alone", () => {
  const document = markWebAnalyticsBeta({
    paths: {
      "/v1/projects/{projectId}/geo/traffic/web/breakdowns": {
        get: { summary: "Get breakdowns", description: "Top pages." },
      },
      "/v1/projects/{projectId}/geo/traffic/imports": {
        get: { summary: "List imports" },
      },
      "/v1/projects/{projectId}/geo/traffic/journeys": {
        get: { summary: "List journeys", description: "Journeys." },
      },
    },
  });
  const paths = document.paths ?? {};
  expect(
    paths["/v1/projects/{projectId}/geo/traffic/web/breakdowns"]?.get
  ).toEqual({
    summary: `Get breakdowns${WEB_ANALYTICS_BETA_SUMMARY_SUFFIX}`,
    description: `${WEB_ANALYTICS_BETA_NOTE} Top pages.`,
  });
  expect(
    paths["/v1/projects/{projectId}/geo/traffic/imports"]?.get?.description
  ).toBe(WEB_ANALYTICS_BETA_NOTE);
  expect(paths["/v1/projects/{projectId}/geo/traffic/journeys"]?.get).toEqual({
    summary: "List journeys",
    description: "Journeys.",
  });
});
