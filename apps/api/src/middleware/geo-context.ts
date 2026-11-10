import { isProjectInOrganization } from "@notra/db/utils/projects";
import { resolveGeoScope } from "@notra/geo-core/geo/projects";
import { runWithGeoRequestMemo } from "@notra/geo-core/utils/request-memo";
import { Effect } from "effect";
import type { Context, Next } from "hono";

import { GEO_PROJECT_NOT_FOUND_ERROR } from "../constants/geo";
import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import type { ApiEnv } from "../types/env";
import { getOrganizationId } from "../utils/auth";
import { getOrganizationResponse } from "../utils/organizations";

const MEMOIZED_METHODS = new Set(["GET", "HEAD"]);

export function geoContextMiddleware() {
  return async (c: Context<ApiEnv>, next: Next) => {
    const organizationId = getOrganizationId(c);
    if (!organizationId) {
      return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
    }

    const db = c.get("db");
    const organization = await getOrganizationResponse(db, organizationId);
    if (!organization) {
      return c.json({ error: "Organization not found" }, 404);
    }

    c.set("geo", { db, organization, organizationId });
    await next();
  };
}

function projectScopeExists(organizationId: string, projectId: string) {
  return Effect.runPromise(
    resolveGeoScope({ organizationId, projectId }).pipe(
      Effect.as(true),
      Effect.catchTag("GeoProjectNotFoundError", () => Effect.succeed(false))
    )
  );
}

export function geoProjectContextMiddleware() {
  return async (c: Context<ApiEnv>, next: Next) => {
    const projectId = c.req.param("projectId");
    const { db, organizationId } = c.get("geo");
    if (!projectId) {
      return c.json({ error: GEO_PROJECT_NOT_FOUND_ERROR }, 404);
    }

    // Writes may change what the memo holds, so only reads share it.
    if (!MEMOIZED_METHODS.has(c.req.method)) {
      if (!(await isProjectInOrganization(organizationId, projectId, db))) {
        return c.json({ error: GEO_PROJECT_NOT_FOUND_ERROR }, 404);
      }
      await next();
      return;
    }

    // The handler's own resolveGeoScope calls reuse this lookup.
    return await runWithGeoRequestMemo(async () => {
      if (!(await projectScopeExists(organizationId, projectId))) {
        return c.json({ error: GEO_PROJECT_NOT_FOUND_ERROR }, 404);
      }
      await next();
    });
  };
}
