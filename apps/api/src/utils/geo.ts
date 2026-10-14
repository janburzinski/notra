import type { createDb } from "@notra/db/drizzle";
import { isProjectInOrganization } from "@notra/db/utils/projects";
import type { Context } from "hono";

import type { GeoFailure } from "../types/geo";
import type { GeoRequestContext } from "../types/geo-context";

type DbClient = ReturnType<typeof createDb>;

export function geoErrorResponse(c: Context, failure: GeoFailure) {
  switch (failure.status) {
    case 400:
      return c.json({ error: failure.error }, 400);
    case 402:
      return c.json({ error: failure.error }, 402);
    case 404:
      return c.json({ error: failure.error }, 404);
    case 409:
      return c.json({ error: failure.error }, 409);
    case 503:
      return c.json({ error: failure.error }, 503);
    default:
      return c.json({ error: failure.error }, 500);
  }
}

export function attachGeoOrganization<T>(
  organization: GeoRequestContext["organization"],
  body: T
): T & { organization: GeoRequestContext["organization"] } {
  return { ...body, organization };
}

export function geoRemoteUnavailableResponse(c: Context, message: string) {
  return c.json({ error: message }, 503);
}

export async function projectBelongsToOrganization(
  db: DbClient,
  organizationId: string,
  projectId: string
): Promise<boolean> {
  return isProjectInOrganization(organizationId, projectId, db);
}
