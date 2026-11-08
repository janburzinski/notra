import { errorResponseSchema } from "@notra/schemas/api/content";
import { InternalDashboardTimeoutError } from "@notra/schemas/api/internal-dashboard";
import type { internalSitesRequestSchema } from "@notra/schemas/api/sites";
import type { Context } from "hono";
import type { z, ZodType } from "zod";

import {
  SITES_INTERNAL_PATH,
  SITES_INTERNAL_TIMEOUT_MS,
  SITES_UNAVAILABLE_ERROR,
} from "../constants/sites";
import { isAccountKeyAuth, isOAuthAuth } from "../types/auth";
import type { ApiEnv } from "../types/env";
import {
  callDashboardInternal,
  getInternalWorkflowUrl,
  InternalDashboardError,
} from "./internal-workflow";

type SitesRequest = z.input<typeof internalSitesRequestSchema>;

/** The Notra user behind the request, recorded on the drafts it saves; null for organization keys. */
export function siteActorUserId(c: Context<ApiEnv>): string | null {
  const auth = c.get("auth");
  return isOAuthAuth(auth) || isAccountKeyAuth(auth) ? auth.userId : null;
}

/** Runs a Sites request in the dashboard, which holds the GitHub App and the Design drafts. */
export async function callSites<A>(
  env: { WORKFLOW_BASE_URL?: string },
  payload: SitesRequest,
  schema: ZodType<A>,
  timeoutMs = SITES_INTERNAL_TIMEOUT_MS
): Promise<A> {
  const url = getInternalWorkflowUrl(env, SITES_INTERNAL_PATH);
  if (!url) {
    throw new InternalDashboardError(503, null, "");
  }
  return await callDashboardInternal(url, payload, schema, timeoutMs);
}

/** Passes the dashboard's own 4xx through; anything else is the dashboard being unavailable. */
export function sitesErrorResponse(c: Context<ApiEnv>, error: unknown) {
  if (error instanceof InternalDashboardError) {
    let body: unknown = null;
    try {
      body = JSON.parse(error.body);
    } catch {
      body = null;
    }
    const parsed = errorResponseSchema.safeParse(body);
    if (
      parsed.success &&
      (error.status === 400 ||
        error.status === 404 ||
        error.status === 409 ||
        error.status === 503)
    ) {
      return c.json(parsed.data, error.status);
    }
  }
  c.get("log").error(error instanceof Error ? error : String(error), {
    errorCode: "sites_request_failed",
  });
  if (error instanceof InternalDashboardTimeoutError) {
    return c.json(
      {
        error:
          "The site's repository didn't answer in time. Check the result with a read before retrying.",
      },
      504
    );
  }
  return c.json({ error: SITES_UNAVAILABLE_ERROR }, 503);
}
