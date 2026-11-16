import { db } from "@notra/db/drizzle";
import { geoSettings } from "@notra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  GEO_MAX_DOMAINS,
  GEO_REJECTED_HOSTS_MIN_HITS,
  GEO_REJECTED_HOSTS_SUGGESTED_MAX,
} from "../constants/geo";
import { loadIngestAllowedHosts } from "../ingest/hosts";
import type {
  GeoRejectedHostInput,
  GeoRejectedHostsResponse,
  GeoScopeInput,
} from "../types/geo";
import {
  matchesProjectHost,
  normalizeProjectDomain,
} from "../utils/geo-project-domains";
import { geoDb } from "./effect";
import { GeoSettingsTrackingError } from "./errors";
import { invalidateGeoIngestHostsCache } from "./ingest-hosts-cache";
import { requireGeoProject } from "./projects";
import {
  dismissRejectedIngestHost,
  forgetRejectedIngestHost,
  readRejectedIngestHosts,
} from "./rejected-hosts-cache";

/** Hosts sending traffic with this project's token that ingest drops. */
export const loadGeoRejectedHosts = Effect.fn("geo.rejectedHosts")(function* (
  input: GeoScopeInput
) {
  const { organizationId, projectId } = yield* requireGeoProject(input);
  const [recorded, allowed] = yield* Effect.promise(() =>
    Promise.all([
      readRejectedIngestHosts(
        organizationId,
        projectId,
        GEO_REJECTED_HOSTS_MIN_HITS
      ).catch(() => []),
      loadIngestAllowedHosts({ organizationId, projectId, generation: 0 }),
    ])
  );
  const response: GeoRejectedHostsResponse = {
    hosts: allowed
      ? recorded
          .filter((host) => !matchesProjectHost(host, allowed))
          .slice(0, GEO_REJECTED_HOSTS_SUGGESTED_MAX)
      : [],
  };
  return response;
});

export const addGeoTrackedDomain = Effect.fn("geo.trackedDomainAdd")(function* (
  input: GeoRejectedHostInput
) {
  const { organizationId, projectId } = yield* requireGeoProject(input);
  const domain = normalizeProjectDomain(input.host);
  if (!domain) {
    return yield* Effect.fail(
      new GeoSettingsTrackingError({
        message: "Enter a domain like example.com",
      })
    );
  }
  const updated = yield* geoDb("tracked domain update failed", () =>
    db
      .update(geoSettings)
      .set({
        domains: sql<string[]>`
            CASE
              WHEN ${domain} = ANY(${geoSettings.domains})
                THEN ${geoSettings.domains}
              WHEN cardinality(${geoSettings.domains}) < ${GEO_MAX_DOMAINS}
                THEN array_append(${geoSettings.domains}, ${domain})
              ELSE ${geoSettings.domains}
            END
          `,
      })
      .where(
        and(
          eq(geoSettings.organizationId, organizationId),
          eq(geoSettings.projectId, projectId)
        )
      )
      .returning({ domains: geoSettings.domains })
  );
  if (!updated.at(0)?.domains?.includes(domain)) {
    return yield* Effect.fail(
      new GeoSettingsTrackingError({
        message: `Tracked domain limit of ${GEO_MAX_DOMAINS} reached`,
      })
    );
  }
  yield* Effect.promise(() =>
    Promise.all([
      invalidateGeoIngestHostsCache(organizationId, projectId),
      forgetRejectedIngestHost(organizationId, projectId, domain),
    ])
  );
  return { domains: updated[0]?.domains ?? [] };
});

export const dismissGeoRejectedHost = Effect.fn("geo.rejectedHostDismiss")(
  function* (input: GeoRejectedHostInput) {
    const { organizationId, projectId } = yield* requireGeoProject(input);
    const host = normalizeProjectDomain(input.host);
    if (host) {
      yield* Effect.promise(() =>
        dismissRejectedIngestHost(organizationId, projectId, host).catch(
          () => undefined
        )
      );
    }
  }
);
