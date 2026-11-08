import type { GeoIngestIdentity } from "../types/geo";
import { geoIngestIdentityKind } from "./geo-ingest-identity-policy";

/** One budget per identity kind, so a public key never shares a private one. */
export function geoIngestAdmissionKey(identity: GeoIngestIdentity): string {
  return JSON.stringify([
    geoIngestIdentityKind(identity),
    identity.organizationId,
    identity.projectId,
    identity.generation,
  ]);
}
