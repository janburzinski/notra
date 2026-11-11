import {
  hasAiTrafficEventsQuota,
  trackAiTrafficEvent,
} from "@notra/ai/billing/ai-traffic-events";
import type { GeoLogEventName } from "@notra/ai/types/evlog";
import {
  ingestGeoTrafficEvents,
  ingestMcpEvents,
  ingestWebErrors,
  ingestWebEvents,
  ingestWebPageEngagement,
  ingestWebPageViews,
} from "@notra/analytics/tinybird/client";
import type { GeoTrafficEventRow } from "@notra/analytics/tinybird/datasources";
import { GEO_INGEST_BEARER_PREFIX } from "@notra/geo-core/constants/geo";
import {
  isGeoIngestSiteToken,
  verifyGeoIngestSiteToken,
  verifyGeoIngestToken,
} from "@notra/geo-core/geo/ingest";
import {
  geoRequestPayloadSchema,
  mcpEventBatchSchema,
  webBeaconRelayPayloadSchema,
  webEngagementPayloadSchema,
} from "@notra/geo-core/schemas/geo";
import type {
  GeoIngestIdentity,
  GeoVisitorType,
} from "@notra/geo-core/types/geo";
import { isTrackedGeoVisitorType } from "@notra/geo-core/utils/ai-traffic";
import { acceptsIngestHost } from "@notra/geo-core/utils/geo-project-domains";
import { isServedBySite } from "@notra/geo-core/utils/ingest-sites";
import { ipNetworkKey, parseIp } from "@notra/utils/client-ip";
import { Effect } from "effect";

import { GEO_INGEST_TINYBIRD_TIMEOUT_MS } from "../constants/ingest";
import { ISO_DATE_LENGTH } from "../constants/web-analytics";
import type {
  GeoIngestBuffer,
  GeoIngestDefer,
  GeoIngestDropReason,
  GeoIngestPayload,
  GeoIngestResult,
  WebBeaconFields,
  WebErrorInput,
  WebEventInput,
  WebPageViewInput,
} from "../types/ingest";
import { geoIngestAdmissionKey } from "../utils/geo-ingest-admission-key";
import {
  geoIngestIdentityKind,
  geoIngestIdentityPolicy,
} from "../utils/geo-ingest-identity-policy";
import { logGeoFailure } from "../utils/geo-log";
import { sanitizeGeoRefererOrigin } from "../utils/geo-referer";
import { isHumanPageView } from "../utils/web-page-view";
import { scrubWebPath } from "../utils/web-path-scrub";
import { trackGeoIngestAnalytics } from "./analytics";
import { classifyVisitor } from "./classify-visitor";
import {
  GeoIngestFailedError,
  GeoIngestInvalidPayloadError,
  GeoIngestInvalidTokenError,
  GeoIngestMissingTokenError,
  GeoIngestRateLimitedError,
  GeoIngestUnparseableUrlError,
} from "./errors";
import { buildGeoTrafficEvent, toCapturedDate } from "./event";
import { loadIngestAllowedHosts } from "./hosts";
import { assertGeoIngestIdentityActive } from "./identity";
import { resolveJourneyId } from "./journey";
import { announceGeoTrafficEvent, expediteForLiveViewers } from "./live";
import { buildMcpEventRow, isMcpEventBody } from "./mcp";
import { geoIngestAdmissionRatelimit, geoIngestRatelimit } from "./ratelimit";
import { hasServerTraffic, markServerTraffic } from "./server-traffic";
import { loadIngestSite, loadOrganizationSitePrefixes } from "./sites";
import {
  buildWebEngagementRow,
  buildWebErrorRow,
  buildWebEventRow,
  buildWebPageView,
  isWebBeaconRelayBody,
} from "./web";
import {
  admitWebAiEvent,
  admitWebNetwork,
  admitWebProject,
} from "./web-limits";

const readSiteIdentity = Effect.fnUntraced(function* (token: string) {
  const siteId = verifyGeoIngestSiteToken(token);
  if (!siteId) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({ authReason: "invalid_signature" })
    );
  }
  const site = yield* Effect.tryPromise({
    try: () => loadIngestSite(siteId),
    catch: (cause) =>
      new GeoIngestFailedError({ cause, stage: "site_lookup", siteId }),
  });
  if (!site) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({ authReason: "site_inactive", siteId })
    );
  }
  return {
    organizationId: site.organizationId,
    projectId: site.projectId,
    generation: 0,
    site: { id: site.id, hosts: site.hosts, mounts: site.mounts },
  } satisfies GeoIngestIdentity;
});

export const readBearerIdentity = Effect.fnUntraced(function* (
  request: Request
) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith(GEO_INGEST_BEARER_PREFIX)
    ? header.slice(GEO_INGEST_BEARER_PREFIX.length).trim()
    : "";

  if (token.length === 0) {
    return yield* Effect.fail(new GeoIngestMissingTokenError({}));
  }

  if (isGeoIngestSiteToken(token)) {
    return yield* readSiteIdentity(token);
  }

  const identity = verifyGeoIngestToken(token);
  if (!identity) {
    return yield* Effect.fail(
      new GeoIngestInvalidTokenError({ authReason: "invalid_signature" })
    );
  }

  return identity;
});

const enforceRateLimit = Effect.fnUntraced(function* (
  organizationId: string,
  admissionKey?: string,
  rate = 1
) {
  const limiter = admissionKey
    ? geoIngestAdmissionRatelimit
    : geoIngestRatelimit;
  const { success, reason } = yield* Effect.tryPromise({
    try: () => limiter.limit(admissionKey ?? organizationId, { rate }),
    catch: (cause) => new GeoIngestFailedError({ cause }),
  });
  // Upstash reports timeouts as success; an unavailable limiter is not approval.
  if (reason === "timeout") {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Rate limit check timed out"),
      })
    );
  }
  if (!success) {
    return yield* Effect.fail(
      new GeoIngestRateLimitedError({ organizationId })
    );
  }
});

const readBody = Effect.fnUntraced(function* (request: Request) {
  return yield* Effect.promise((): Promise<unknown> =>
    request.json().catch(() => null)
  );
});

const readPayload = Effect.fnUntraced(function* (body: unknown) {
  const parsed = geoRequestPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return yield* Effect.fail(
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  return parsed.data;
});

const parseUrl = Effect.fnUntraced(function* (value: string) {
  return yield* Effect.try({
    try: () => new URL(value),
    catch: () => new GeoIngestUnparseableUrlError({ url: value }),
  });
});

const admitWebPageView = Effect.fnUntraced(function* (admissionKey: string) {
  return yield* Effect.promise(() => admitWebProject(admissionKey));
});

/**
 * Whether a page is on one of the identity's hosts. A public key cannot be
 * trusted to name its own pages, so for it a failed lookup refuses the beacon.
 */
function acceptsBeaconHost(
  identity: GeoIngestIdentity,
  url: URL,
  allowedHosts: readonly string[] | null
): boolean {
  if (allowedHosts === null && geoIngestIdentityKind(identity) === "web") {
    return false;
  }
  return (
    acceptsIngestHost(url.hostname, allowedHosts) &&
    !isOutsideSiteMounts(identity, url)
  );
}

/**
 * Hands a web row to the batcher, else writes it now. A failed write is
 * logged and never fails the beacon.
 */
function storeWebRow<Row extends { organization_id: string }>(
  row: Row,
  enqueued: boolean | undefined,
  write: (rows: Row[]) => Promise<unknown>,
  failure: { event: GeoLogEventName; message: string }
) {
  if (enqueued) {
    return Effect.void;
  }
  return Effect.promise(() =>
    write([row]).catch((error: unknown) => {
      logGeoFailure(failure.event, failure.message, error, {
        organizationId: row.organization_id,
      });
      return null;
    })
  );
}

const writeTinybirdRows = Effect.fn("geoIngest.ingest")(function* (
  ingest: () => ReturnType<typeof ingestGeoTrafficEvents>
) {
  const result = yield* Effect.tryPromise({
    try: ingest,
    catch: (cause) => new GeoIngestFailedError({ cause }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: GEO_INGEST_TINYBIRD_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new GeoIngestFailedError({
            cause: new Error(
              `Tinybird write timed out after ${GEO_INGEST_TINYBIRD_TIMEOUT_MS}ms`
            ),
          })
        ),
    })
  );
  if (!result) {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Tinybird is not configured"),
      })
    );
  }
  if (result.quarantined_rows > 0) {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Tinybird quarantined events"),
      })
    );
  }
});

export const writeGeoTrafficEvents = (rows: GeoTrafficEventRow[]) =>
  writeTinybirdRows(() => ingestGeoTrafficEvents(rows));

const failWithAuthPrecedence = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity,
  error: GeoIngestInvalidPayloadError | GeoIngestUnparseableUrlError
) {
  // A malformed public beacon spends the web budget, never a private one,
  // and stops there when it is spent: no database check for it either.
  if (identity.web) {
    if (!(yield* admitWebPageView(geoIngestAdmissionKey(identity)))) {
      return yield* Effect.fail(
        new GeoIngestRateLimitedError({
          organizationId: identity.organizationId,
        })
      );
    }
  } else {
    yield* enforceRateLimit(
      identity.organizationId,
      geoIngestAdmissionKey(identity)
    );
  }
  yield* assertGeoIngestIdentityActive(identity);
  return yield* Effect.fail(error);
});

function trackUsage(
  buffer: GeoIngestBuffer | undefined,
  organizationId: string,
  value = 1
): Promise<void> {
  if (buffer?.trackUsage?.(organizationId, value)) {
    return Promise.resolve();
  }
  return trackAiTrafficEvent(organizationId, value).then(() => undefined);
}

export function droppedResult(
  identity: GeoIngestIdentity,
  visitorType: GeoVisitorType,
  reason: GeoIngestDropReason,
  host?: string
): GeoIngestResult {
  return {
    outcome: "dropped",
    reason,
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType,
    ...(host === undefined ? {} : { host }),
  };
}

function webOnlyResult(
  identity: GeoIngestIdentity,
  visitorType: GeoVisitorType
): GeoIngestResult {
  return {
    outcome: "ingested",
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType,
    source: "",
    agent: "",
    ingestMs: 0,
  };
}

function isOutsideSiteMounts(identity: GeoIngestIdentity, url: URL): boolean {
  return (
    identity.site !== undefined &&
    !isServedBySite(url, [{ host: url.hostname, mounts: identity.site.mounts }])
  );
}

/**
 * The checks engagement, outbound clicks and errors share: the identity records
 * visits, the web budget admits the beacon, and the page is on a tracked
 * host. Returns a drop result, or null to store the row.
 */
const admitWebBeacon = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity,
  url: URL
) {
  if (!geoIngestIdentityPolicy(identity).recordsVisits) {
    return droppedResult(identity, "human", "not_site");
  }
  if (!(yield* admitWebPageView(geoIngestAdmissionKey(identity)))) {
    return droppedResult(identity, "human", "web_rate_limited");
  }
  const [, allowedHosts] = yield* Effect.all(
    [
      assertGeoIngestIdentityActive(identity),
      Effect.promise(() => loadIngestAllowedHosts(identity)),
    ],
    { concurrency: "unbounded" }
  );
  if (!acceptsBeaconHost(identity, url, allowedHosts)) {
    return droppedResult(identity, "human", "host", url.hostname);
  }
  return null;
});

const runWebEngagementIngest = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity,
  body: unknown,
  buffer: GeoIngestBuffer | undefined,
  hashRoutes = false
) {
  if (!geoIngestIdentityPolicy(identity).recordsVisits) {
    return droppedResult(identity, "human", "not_site");
  }
  const parsed = webEngagementPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return yield* failWithAuthPrecedence(
      identity,
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  const payload = parsed.data;
  const urlResult = yield* Effect.result(parseUrl(payload.url));
  if (urlResult._tag === "Failure") {
    return yield* failWithAuthPrecedence(identity, urlResult.failure);
  }
  const url = urlResult.success;
  const dropped = yield* admitWebBeacon(identity, url);
  if (dropped) {
    return dropped;
  }
  const row = buildWebEngagementRow({
    identity,
    payload,
    url,
    capturedAt: toCapturedDate(payload.timestamp),
    hashRoutes,
  });
  yield* storeWebRow(
    row,
    buffer?.enqueueEngagement?.(row),
    ingestWebPageEngagement,
    {
      event: "geo.ingest.engagement_write_failed",
      message: "Web engagement write failed",
    }
  );
  return webOnlyResult(identity, "human");
});

const runWebEventIngest = Effect.fnUntraced(function* (
  input: WebEventInput,
  buffer: GeoIngestBuffer | undefined
) {
  const dropped = yield* admitWebBeacon(input.identity, input.url);
  if (dropped) {
    return dropped;
  }
  const row = yield* Effect.promise(() =>
    buildWebEventRow(input).catch(() => null)
  );
  if (row) {
    yield* storeWebRow(row, buffer?.enqueueWebEvent?.(row), ingestWebEvents, {
      event: "geo.ingest.web_event_write_failed",
      message: "Web event write failed",
    });
  }
  return webOnlyResult(input.identity, "human");
});

const runWebErrorIngest = Effect.fnUntraced(function* (
  input: WebErrorInput,
  buffer: GeoIngestBuffer | undefined
) {
  const dropped = yield* admitWebBeacon(input.identity, input.url);
  if (dropped) {
    return dropped;
  }
  const row = buildWebErrorRow(input);
  yield* storeWebRow(row, buffer?.enqueueWebError?.(row), ingestWebErrors, {
    event: "geo.ingest.web_error_write_failed",
    message: "Web error write failed",
  });
  return webOnlyResult(input.identity, "human");
});

const runMcpEventIngest = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity,
  body: unknown,
  defer: GeoIngestDefer,
  buffer: GeoIngestBuffer | undefined
) {
  const parsed = mcpEventBatchSchema.safeParse(body);
  if (!parsed.success) {
    return yield* failWithAuthPrecedence(
      identity,
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  yield* enforceRateLimit(
    identity.organizationId,
    geoIngestAdmissionKey(identity)
  );
  yield* assertGeoIngestIdentityActive(identity);
  if (!(yield* hasAiTrafficEventsQuota(identity.organizationId))) {
    return droppedResult(identity, "unknown", "quota");
  }
  const { events } = parsed.data;
  yield* enforceRateLimit(identity.organizationId, undefined, events.length);

  const rows = events.map((payload) =>
    buildMcpEventRow({
      identity,
      payload,
      capturedAt: toCapturedDate(payload.timestamp),
    })
  );
  const ingestStartedAt = Date.now();
  yield* writeTinybirdRows(() => ingestMcpEvents(rows));
  const ingestMs = Date.now() - ingestStartedAt;
  yield* Effect.sync(() =>
    defer(() => trackUsage(buffer, identity.organizationId, rows.length))
  );

  return {
    outcome: "ingested",
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType: "unknown",
    source: "mcp",
    agent: rows[0]?.client_name ?? "",
    ingestMs,
  } satisfies GeoIngestResult;
});

export const runGeoEnvelopeIngest = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity,
  body: unknown,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer,
  beacon: Pick<WebPageViewInput, "viewId" | "hashRoutes"> = {}
) {
  const payloadResult = yield* Effect.result(readPayload(body));
  if (payloadResult._tag === "Failure") {
    return yield* failWithAuthPrecedence(identity, payloadResult.failure);
  }
  const payload = payloadResult.success;

  const urlResult = yield* Effect.result(parseUrl(payload.url));
  if (urlResult._tag === "Failure") {
    return yield* failWithAuthPrecedence(identity, urlResult.failure);
  }
  const url = urlResult.success;
  const classification = classifyVisitor({
    userAgent: payload.userAgent,
    referer: payload.referer,
    accept: payload.accept,
    signals: payload.signals,
  });
  const policy = geoIngestIdentityPolicy(identity);
  const isWeb = geoIngestIdentityKind(identity) === "web";
  let isAi = false;
  if (policy.aiEvents === "tracked") {
    isAi = isTrackedGeoVisitorType(classification.visitorType);
  } else if (policy.aiEvents === "referrals-without-server") {
    isAi =
      classification.visitorType === "ai_referral" &&
      !(yield* Effect.promise(() => hasServerTraffic(identity)));
  } else {
    isAi =
      classification.visitorType === "ai_referral" &&
      payload.visitorConsent === true;
  }
  const countsVisitors =
    policy.recordsVisits &&
    payload.visitorConsent !== false &&
    isHumanPageView({ classification, payload, url });
  if (!(isAi || countsVisitors)) {
    return droppedResult(identity, classification.visitorType, "visitor_type");
  }
  // Behind a cookie banner a Site's reports carry the stored choice, but a
  // visitor who allows measurement on the landing page has none yet. Their
  // AI referral comes from the notra.js page view the grant lets run, so the
  // server report leaves every referral to it and each counts once.
  if (
    classification.visitorType === "ai_referral" &&
    (payload.visitorConsent === false ||
      (payload.visitorConsent !== undefined &&
        geoIngestIdentityKind(identity) === "site"))
  ) {
    return droppedResult(identity, classification.visitorType, "consent");
  }

  // A person's page view, and anything a public key sends, is admitted on the
  // web budget; the AI budget only decides whether the extra AI event is
  // written (see below). Public keys never touch the server SDK's budgets.
  if (!(countsVisitors || isWeb)) {
    yield* enforceRateLimit(
      identity.organizationId,
      geoIngestAdmissionKey(identity)
    );
  } else if (!(yield* admitWebPageView(geoIngestAdmissionKey(identity)))) {
    return droppedResult(
      identity,
      classification.visitorType,
      "web_rate_limited"
    );
  }
  const [, allowedHosts, sitePrefixes] = yield* Effect.all(
    [
      assertGeoIngestIdentityActive(identity),
      Effect.promise(() => loadIngestAllowedHosts(identity)),
      identity.site
        ? Effect.succeed(null)
        : Effect.promise(() =>
            loadOrganizationSitePrefixes(
              identity.organizationId,
              policy.cachesChecks
            )
          ),
    ],
    { concurrency: "unbounded" }
  );
  if (!identity.projectId && allowedHosts === null) {
    return yield* Effect.fail(
      new GeoIngestFailedError({
        cause: new Error("Traffic host lookup failed"),
      })
    );
  }
  if (!acceptsBeaconHost(identity, url, allowedHosts)) {
    return droppedResult(
      identity,
      classification.visitorType,
      "host",
      url.hostname
    );
  }
  if (sitePrefixes && isServedBySite(url, sitePrefixes)) {
    return droppedResult(
      identity,
      classification.visitorType,
      "site",
      url.hostname
    );
  }

  const capturedAt = toCapturedDate(payload.timestamp);
  const webRow = countsVisitors
    ? yield* Effect.promise(() =>
        buildWebPageView({
          identity,
          payload,
          url,
          capturedAt,
          classification,
          ...beacon,
        }).catch(() => null)
      )
    : null;
  if (webRow) {
    yield* storeWebRow(
      webRow,
      buffer?.enqueueWeb?.(webRow),
      ingestWebPageViews,
      {
        event: "geo.ingest.web_write_failed",
        message: "Web page view write failed",
      }
    );
  }
  if (!isAi) {
    return webOnlyResult(identity, classification.visitorType);
  }
  if (!(yield* hasAiTrafficEventsQuota(identity.organizationId))) {
    return droppedResult(
      identity,
      classification.visitorType,
      "quota",
      url.hostname
    );
  }

  const resolved = resolveJourneyId({
    url,
    source: classification.source,
    ip: payload.ip,
    capturedAt,
    visitorType: classification.visitorType,
    category: classification.category,
  });
  const journey = isWeb
    ? { ...resolved, path: scrubWebPath(resolved.path) }
    : resolved;
  const event = buildGeoTrafficEvent({
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    siteId: identity.site?.id,
    // A browser's referrer can carry anything in its path; keep the origin.
    payload: isWeb
      ? { ...payload, referer: sanitizeGeoRefererOrigin(payload.referer) }
      : payload,
    url,
    capturedAt,
    classification,
    journey,
  });

  if (isWeb) {
    const day = capturedAt.toISOString().slice(0, ISO_DATE_LENGTH);
    if (!(yield* Effect.promise(() => admitWebAiEvent(identity, day)))) {
      return webOnlyResult(identity, classification.visitorType);
    }
  } else if (countsVisitors) {
    const admitted = yield* Effect.result(
      enforceRateLimit(
        identity.organizationId,
        geoIngestAdmissionKey(identity)
      ).pipe(Effect.andThen(enforceRateLimit(identity.organizationId)))
    );
    if (admitted._tag === "Failure") {
      return webOnlyResult(identity, classification.visitorType);
    }
  } else {
    yield* enforceRateLimit(identity.organizationId);
  }
  const ingestStartedAt = Date.now();
  const buffered = buffer?.enqueue(event) ?? false;
  if (!buffered) {
    yield* writeGeoTrafficEvents([event]);
  }
  const ingestMs = Date.now() - ingestStartedAt;
  yield* Effect.sync(() =>
    defer(async () => {
      if (policy.marksServerTraffic) {
        await markServerTraffic(identity);
      }
      const announced =
        buffered && buffer
          ? expediteForLiveViewers(buffer, event.organization_id)
          : announceGeoTrafficEvent(event.organization_id, event.project_id);
      const tracked = trackUsage(buffer, event.organization_id);
      try {
        await Effect.runPromise(trackGeoIngestAnalytics({ identity, event }));
      } catch (error) {
        logGeoFailure(
          "geo.ingest.analytics_failed",
          "Deferred ingest analytics failed",
          error,
          {
            organizationId: identity.organizationId,
            projectId: identity.projectId,
          }
        );
      }
      await Promise.all([announced, tracked]);
    })
  );

  return {
    outcome: "ingested",
    organizationId: identity.organizationId,
    projectId: identity.projectId,
    visitorType: classification.visitorType,
    source: classification.source,
    agent: classification.agent,
    ingestMs,
  } satisfies GeoIngestResult;
});

/**
 * One notra.js beacon once its sender is known: a public key (`runWebCollect`)
 * or a Notra Site that relays it. `envelope` is the page view's request,
 * rebuilt from the beacon. A beacon is an outbound link click (`o`), else an
 * error (`x`), else engagement with web vitals (`t`), else a page view.
 */
export const runWebBeacon = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity,
  beacon: WebBeaconFields,
  envelope: GeoIngestPayload,
  url: URL,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer
) {
  const hashRoutes = beacon.h === true;
  if (
    beacon.o === undefined &&
    beacon.x === undefined &&
    beacon.t === undefined
  ) {
    return yield* runGeoEnvelopeIngest(identity, envelope, defer, buffer, {
      viewId: beacon.v,
      hashRoutes,
    });
  }

  // Outbound clicks, errors and engagement skip the page view's classification;
  // apply its user-agent checks here so automation cannot add them on its own.
  const classification = classifyVisitor({
    userAgent: envelope.userAgent,
    referer: undefined,
    accept: envelope.accept,
    signals: envelope.signals,
  });
  if (!isHumanPageView({ classification, payload: envelope, url })) {
    return droppedResult(identity, classification.visitorType, "visitor_type");
  }
  const capturedAt = new Date();
  if (beacon.o !== undefined) {
    return yield* runWebEventIngest(
      {
        identity,
        payload: envelope,
        url,
        capturedAt,
        viewId: beacon.v,
        outboundUrl: beacon.o,
        hashRoutes,
      },
      buffer
    );
  }
  if (beacon.x !== undefined) {
    return yield* runWebErrorIngest(
      {
        identity,
        payload: envelope,
        url,
        capturedAt,
        viewId: beacon.v,
        error: {
          message: beacon.x,
          source: beacon.xs ?? "",
          line: beacon.xl ?? 0,
        },
        hashRoutes,
      },
      buffer
    );
  }
  return yield* runWebEngagementIngest(
    identity,
    {
      type: "engagement",
      url: envelope.url,
      viewId: beacon.v,
      visibleMs: beacon.t,
      scrollDepth: beacon.s ?? 0,
      lcpMs: beacon.l,
      fcpMs: beacon.f,
      ttfbMs: beacon.b,
      inpMs: beacon.i,
      clsMilli: beacon.c,
    },
    buffer,
    hashRoutes
  );
});

/**
 * A notra.js beacon a Notra Site relays from its own origin. Only a Site's
 * token may relay one: the Site vouches for the client IP and country in the
 * rebuilt request, which a public key could forge.
 */
const runSiteBeaconRelay = Effect.fnUntraced(function* (
  identity: GeoIngestIdentity,
  body: unknown,
  defer: GeoIngestDefer,
  buffer: GeoIngestBuffer | undefined
) {
  if (!identity.site || identity.web) {
    return droppedResult(identity, "human", "not_site");
  }
  const beaconIdentity: GeoIngestIdentity = { ...identity, web: true };
  const parsed = webBeaconRelayPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return yield* failWithAuthPrecedence(
      beaconIdentity,
      new GeoIngestInvalidPayloadError({ issues: parsed.error.issues })
    );
  }
  const { request, beacon, proxied } = parsed.data;
  const urlResult = yield* Effect.result(parseUrl(request.url));
  if (urlResult._tag === "Failure") {
    return yield* failWithAuthPrecedence(beaconIdentity, urlResult.failure);
  }
  // Behind the customer's proxy the IP comes from X-Forwarded-For (or is
  // the proxy's own), so it can't key a per-network limit.
  const ip = request.ip && !proxied ? parseIp(request.ip) : null;
  if (
    !(yield* Effect.promise(() =>
      admitWebNetwork(beaconIdentity, ip ? ipNetworkKey(ip) : null)
    ))
  ) {
    return droppedResult(beaconIdentity, "human", "network_rate_limited");
  }
  return yield* runWebBeacon(
    beaconIdentity,
    beacon,
    request,
    urlResult.success,
    defer,
    buffer
  );
});

// Only request entry points are traced: Effect.fn captures a stack and opens a
// span on every call, which cost a quarter of the CPU per beacon in profiles.
export const runGeoIngest = Effect.fn("geoIngest.run")(function* (
  request: Request,
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer
) {
  const identity = yield* readBearerIdentity(request);
  const body = yield* readBody(request);
  if (isWebBeaconRelayBody(body)) {
    return yield* runSiteBeaconRelay(identity, body, defer, buffer);
  }
  if (isMcpEventBody(body)) {
    return yield* runMcpEventIngest(identity, body, defer, buffer);
  }
  return yield* runGeoEnvelopeIngest(identity, body, defer, buffer);
});
