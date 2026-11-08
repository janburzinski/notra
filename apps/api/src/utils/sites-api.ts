import type { Context } from "hono";
import type { ZodType } from "zod";

import {
  SITES_API_FORWARDED_STATUSES,
  SITES_API_INTERNAL_PATH,
  SITES_API_INTERNAL_TIMEOUT_MS,
} from "../constants/sites";
import type { ApiEnv } from "../types/env";
import type { SitesFailure, SitesForwardedStatus } from "../types/sites";
import {
  callDashboardInternal,
  getInternalWorkflowUrl,
  InternalDashboardError,
  InternalDashboardTimeoutError,
} from "./internal-workflow";
import { logError } from "./logging";

function isForwardedStatus(status: number): status is SitesForwardedStatus {
  return (SITES_API_FORWARDED_STATUSES as readonly number[]).includes(status);
}

function readErrorMessage(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof parsed.error === "string"
    ) {
      return parsed.error;
    }
  } catch {
    return null;
  }
  return null;
}

/** Runs a Sites deployment, preview or publication action in the dashboard, which owns builds, R2 and GitHub. */
export async function callSitesApi<A>(
  c: Context<ApiEnv>,
  payload: Record<string, unknown> & { action: string },
  schema: ZodType<A>
): Promise<{ ok: true; value: A } | ({ ok: false } & SitesFailure)> {
  const url = getInternalWorkflowUrl(c.env ?? {}, SITES_API_INTERNAL_PATH);
  if (!url) {
    return { ok: false, status: 503, error: "Notra Sites is not available" };
  }
  try {
    return {
      ok: true,
      value: await callDashboardInternal(
        url,
        payload,
        schema,
        SITES_API_INTERNAL_TIMEOUT_MS
      ),
    };
  } catch (error) {
    if (error instanceof InternalDashboardTimeoutError) {
      return {
        ok: false,
        status: 504,
        error:
          "The Sites request timed out and may still complete. Check the Site before retrying.",
      };
    }
    if (
      error instanceof InternalDashboardError &&
      isForwardedStatus(error.status)
    ) {
      return {
        ok: false,
        status: error.status,
        error: readErrorMessage(error.body) ?? "Sites request failed",
      };
    }
    logError(`Sites ${payload.action} failed`, error);
    return { ok: false, status: 502, error: "Sites request failed" };
  }
}

export function sitesFailureResponse(c: Context, failure: SitesFailure) {
  const body = { error: failure.error };
  switch (failure.status) {
    case 400:
      return c.json(body, 400);
    case 402:
      return c.json(body, 402);
    case 403:
      return c.json(body, 403);
    case 404:
      return c.json(body, 404);
    case 409:
      return c.json(body, 409);
    case 429:
      return c.json(body, 429);
    case 503:
      return c.json(body, 503);
    case 504:
      return c.json(body, 504);
    default:
      return c.json(body, 502);
  }
}
