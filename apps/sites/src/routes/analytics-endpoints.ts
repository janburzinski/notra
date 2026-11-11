import { Effect, Option } from "effect";

import {
  analyticsScriptResponse,
  isAnalyticsEventPath,
  isForeignAnalyticsPost,
  readAnalyticsBeacon,
} from "../analytics";
import { ANALYTICS_STATUS_PARAM } from "../constants/analytics";
import { analyticsAccepted } from "../responses/analytics-accepted";
import { analyticsRejected } from "../responses/analytics-rejected";
import { methodNotAllowed } from "../responses/method-not-allowed";
import { isDashboardReferer, reportBeacon } from "../traffic";
import type { DeploymentRouteContext } from "../types/routes";
import { analyticsScriptTag } from "../utils/analytics-tag";
import { publicPageUrl } from "../utils/public-url";

export const analyticsEndpointsRoute = Effect.fnUntraced(function* ({
  deps,
  request,
  url,
  host,
  origin,
  resolved,
  loaded,
  visitorConsent,
}: DeploymentRouteContext) {
  const tag = analyticsScriptTag(
    resolved,
    loaded,
    url.pathname,
    visitorConsent
  );
  const isScript = tag !== null && url.pathname === tag.scriptSrc;
  const isEvent = isAnalyticsEventPath(url.pathname);
  if (!(isScript || isEvent)) {
    return Option.none<Response>();
  }
  if (isScript) {
    return Option.some(
      request.method === "POST"
        ? methodNotAllowed("GET, HEAD")
        : analyticsScriptResponse(url)
    );
  }
  if (request.method !== "POST") {
    return Option.some(methodNotAllowed("POST"));
  }
  const publicOrigin = loaded.manifest.target.publicOrigin;
  if (
    isForeignAnalyticsPost(request, [
      origin,
      url.origin,
      URL.canParse(publicOrigin) ? new URL(publicOrigin).origin : publicOrigin,
    ])
  ) {
    return Option.some(analyticsRejected());
  }
  const beacon =
    tag !== null && url.pathname === tag.eventPath
      ? yield* Effect.promise(() => readAnalyticsBeacon(request))
      : null;
  if (
    !(tag && beacon && resolved.trafficToken && deps.trafficIngestUrl) ||
    // Opening the site from the dashboard is not a visit.
    (beacon.isPageView &&
      isDashboardReferer(beacon.referrer, deps.dashboardUrl))
  ) {
    return Option.some(analyticsAccepted());
  }
  deps.waitUntil(
    reportBeacon({
      fetch: deps.fetch,
      ingestUrl: deps.trafficIngestUrl,
      token: resolved.trafficToken,
      request,
      method: "GET",
      referer: beacon.referrer || null,
      publicUrl: publicPageUrl(beacon.page, publicOrigin),
      proxied: new URL(publicOrigin).hostname !== host,
      // 404 pages post with `?s=404`, so missing pages keep their status.
      status:
        url.searchParams.get(ANALYTICS_STATUS_PARAM) === "404" ? 404 : 200,
      // Behind a cookie banner notra.js only runs once the visitor allowed
      // measurement.
      visitorConsent: tag.consent ? true : undefined,
      beacon: beacon.fields,
    })
  );
  return Option.some(analyticsAccepted());
});
