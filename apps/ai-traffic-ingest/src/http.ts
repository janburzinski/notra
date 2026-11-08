import { logError } from "@notra/ai/utils/server-log";
import {
  GEO_DRAIN_PATHS,
  GEO_DRAIN_PROVIDERS,
  GEO_INGEST_PATH,
  GEO_WEB_COLLECT_PATH,
  GEO_WEB_PLUS_SCRIPT_PATH,
  GEO_WEB_SCRIPT_PATH,
} from "@notra/geo-core/constants/geo";
import {
  GEO_DRAIN_MAX_BODY_BYTES,
  GEO_WEB_COLLECT_MAX_BODY_BYTES,
} from "@notra/geo-core/constants/ingest";
import {
  handleGeoDrainRequest,
  handleGeoIngestRequest,
  handleWebCollectRequest,
} from "@notra/geo-core/ingest/handler";
import {
  webCollectPreflightResponse,
  withWebCollectCors,
} from "@notra/geo-core/ingest/response";
import type {
  GeoIngestBuffer,
  GeoIngestDefer,
  WebCollectOptions,
} from "@notra/geo-core/types/ingest";
import {
  trackerPlusScriptResponse,
  trackerReleaseResponse,
  trackerScriptResponse,
} from "@notra/web-tracker/response";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import {
  INGEST_MAX_BODY_BYTES,
  TRACKER_RELEASE_ROUTE,
} from "./constants/server";
import { missingIngestEnvironment } from "./utils/config";
import { payloadTooLarge } from "./utils/payload-too-large";

export function createIngestApp(
  defer: GeoIngestDefer,
  buffer?: GeoIngestBuffer,
  collect?: WebCollectOptions
) {
  const app = new Hono();

  app.use("*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    await next();
  });

  // evlog-map-disable-next-line -- health probe
  app.get("/healthz", (context) => context.json({ ok: true }));
  // evlog-map-disable-next-line -- readiness probe
  app.get("/readyz", (context) => {
    const ready = missingIngestEnvironment().length === 0;
    return context.json({ ready }, ready ? 200 : 503);
  });

  const postRoute = (
    path: string,
    maxSize: number,
    handle: (request: Request) => Promise<Response>
  ) => {
    app.post(
      path,
      bodyLimit({ maxSize, onError: payloadTooLarge }),
      async (context) => {
        if (missingIngestEnvironment().length > 0) {
          return context.json({ error: "Ingest is not configured" }, 503);
        }
        return handle(context.req.raw);
      }
    );
    app.all(path, (context) => {
      context.header("Allow", "POST");
      return context.body(null, 405);
    });
  };

  app.get(GEO_WEB_SCRIPT_PATH, (context) =>
    trackerScriptResponse(context.req.raw)
  );
  app.get(GEO_WEB_PLUS_SCRIPT_PATH, (context) =>
    trackerPlusScriptResponse(context.req.raw)
  );
  app.get(TRACKER_RELEASE_ROUTE, (context) =>
    trackerReleaseResponse(context.req.raw)
  );
  // notra.js posts with a CORS fetch, so every answer, including the body
  // limit's 413, must carry CORS headers or the browser rejects it.
  app.use(GEO_WEB_COLLECT_PATH, async (context, next) => {
    await next();
    context.res = withWebCollectCors(
      new Response(context.res.body, context.res)
    );
  });
  app.options(GEO_WEB_COLLECT_PATH, webCollectPreflightResponse);
  postRoute(GEO_WEB_COLLECT_PATH, GEO_WEB_COLLECT_MAX_BODY_BYTES, (request) =>
    handleWebCollectRequest(request, defer, buffer, collect)
  );
  postRoute(GEO_INGEST_PATH, INGEST_MAX_BODY_BYTES, (request) =>
    handleGeoIngestRequest(request, defer, buffer)
  );
  for (const provider of GEO_DRAIN_PROVIDERS) {
    postRoute(GEO_DRAIN_PATHS[provider], GEO_DRAIN_MAX_BODY_BYTES, (request) =>
      handleGeoDrainRequest(request, provider, defer, buffer)
    );
  }

  app.notFound((context) => context.body(null, 404));
  app.onError((error, context) => {
    logError("[geo-ingest] Request failed", error, {
      method: context.req.method,
      path: context.req.path,
    });
    return context.json({ error: "Ingest failed" }, 502);
  });

  return app;
}
