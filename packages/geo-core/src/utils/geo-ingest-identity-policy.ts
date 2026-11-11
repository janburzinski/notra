import { GEO_INGEST_IDENTITY_POLICIES } from "../constants/ingest";
import type { GeoIngestIdentity } from "../types/geo";
import type {
  GeoIngestIdentityKind,
  GeoIngestIdentityPolicy,
} from "../types/ingest";

export function geoIngestIdentityKind(
  identity: GeoIngestIdentity
): GeoIngestIdentityKind {
  if (identity.site) {
    return identity.web ? "site-beacon" : "site";
  }
  return identity.web ? "web" : "server";
}

export function geoIngestIdentityPolicy(
  identity: GeoIngestIdentity
): GeoIngestIdentityPolicy {
  return GEO_INGEST_IDENTITY_POLICIES[geoIngestIdentityKind(identity)];
}

/** Cache key for one organization or project scope. */
export function geoIngestScopeKey(
  identity: Pick<GeoIngestIdentity, "organizationId" | "projectId">
): string {
  return `${identity.organizationId}:${identity.projectId ?? "-"}`;
}
