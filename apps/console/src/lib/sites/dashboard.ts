import "server-only";
import {
  badRequest,
  internalServerError,
  notFound,
  tooManyRequests,
} from "@/lib/orpc/utils/errors";
import { siteAdminErrorSchema } from "@/schemas/sites";
import type { SiteAdminRequest } from "@/types/sites";

const SITE_ADMIN_PATH = "/api/internal/sites/admin";
/**
 * Calls the dashboard's internal site admin route. Builds, rollbacks,
 * suspensions and Tinybird analytics run there because they depend on
 * `@notra/sites-server` and the dashboard's workflow runtime.
 */
export async function callSiteAdmin(input: SiteAdminRequest): Promise<unknown> {
  const baseUrl = process.env.NOTRA_DASHBOARD_URL;
  if (!baseUrl) {
    throw internalServerError("NOTRA_DASHBOARD_URL is not configured");
  }
  const secret = process.env.INTERNAL_WORKFLOW_SECRET;
  const response = await fetch(new URL(SITE_ADMIN_PATH, baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(input),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw internalServerError("Could not reach the Notra dashboard", error);
  });

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) {
    return payload;
  }
  const parsed = siteAdminErrorSchema.safeParse(payload);
  const message = parsed.success
    ? parsed.data.error
    : `Dashboard responded with ${response.status}`;
  switch (response.status) {
    case 400:
    case 422:
      throw badRequest(message);
    case 404:
      throw notFound(message);
    case 429:
      throw tooManyRequests(message);
    default:
      throw internalServerError(message);
  }
}
