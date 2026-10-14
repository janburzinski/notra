import { defineRailway, preserve, project, service, volume } from "railway/iac";

import {
  monitoringService,
  monitoringVolume,
} from "./constants/observability.ts";
import { productionTarget } from "./constants/targets.ts";
import { assertTarget } from "./utils/assert-target.ts";

export const partial = "observability";

export default defineRailway((ctx) => {
  assertTarget(ctx, productionTarget);

  const grafanaVolume = volume("grafana-volume", monitoringVolume);
  const prometheusVolume = volume("prometheus-volume", monitoringVolume);
  const lokiVolume = volume("loki-volume", monitoringVolume);
  const collectorVolume = volume("otel-collector-volume", monitoringVolume);

  const grafana = service("grafana", {
    ...monitoringService,
    healthcheck: "/api/health",
    volumeMounts: { "/var/lib/grafana": grafanaVolume },
    env: {
      GF_SECURITY_ADMIN_PASSWORD: preserve(),
      GF_SECURITY_SECRET_KEY: preserve(),
      NOTRA_ORGANIZATION_NAMES: preserve(),
      PORT: "3000",
      RAILWAY_RUN_UID: "0",
    },
  });
  const prometheus = service("prometheus", {
    ...monitoringService,
    healthcheck: "/metrics",
    volumeMounts: { "/prometheus": prometheusVolume },
    env: { PORT: "9090", RAILWAY_RUN_UID: "0" },
  });
  const loki = service("loki", {
    ...monitoringService,
    healthcheck: "/ready",
    volumeMounts: { "/loki": lokiVolume },
    env: { PORT: "3100", RAILWAY_RUN_UID: "0" },
  });
  const collector = service("otel-collector", {
    ...monitoringService,
    healthcheck: "/",
    volumeMounts: { "/var/lib/otelcol": collectorVolume },
    env: {
      NOTRA_OTLP_TOKEN: preserve(),
      PORT: "13133",
      RAILWAY_RUN_UID: "0",
    },
  });
  const blackbox = service("blackbox", {
    ...monitoringService,
    healthcheck: "/",
    env: {
      NOTRA_PROBE_API_KEY: preserve(),
      PORT: "9115",
      RAILWAY_RUN_UID: "65534",
    },
  });
  const tunnel = service("monitoring-tunnel", {
    ...monitoringService,
    healthcheck: "/ready",
    env: { PORT: "2000", TUNNEL_TOKEN: preserve() },
  });
  const vercel = service("vercel-metrics", {
    ...monitoringService,
    healthcheck: "/healthz",
    env: {
      PORT: "9091",
      RAILWAY_RUN_UID: "1000",
      VERCEL_TEAM_ID: "team_J0UtPqQdb8AdDMRkyvJuR8kM",
      VERCEL_MONITORING_TOKEN: preserve(),
    },
  });

  return project("notra-prod", {
    resources: [
      grafana,
      prometheus,
      loki,
      collector,
      blackbox,
      tunnel,
      vercel,
      grafanaVolume,
      prometheusVolume,
      lokiVolume,
      collectorVolume,
    ],
  });
});
