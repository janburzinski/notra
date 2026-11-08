import { isWebAnalyticsEnabledForOrganization } from "@notra/ai/utils/web-analytics-access";
import type { Context } from "hono";

import type { ApiEnv } from "../types/env";

/** The organization's web analytics flag, evaluated once per request. */
export function isWebAnalyticsEnabledForRequest(
  c: Context<ApiEnv>
): Promise<boolean> {
  let enabled = c.get("webAnalyticsEnabled");
  if (!enabled) {
    enabled = isWebAnalyticsEnabledForOrganization(c.get("geo").organizationId);
    c.set("webAnalyticsEnabled", enabled);
  }
  return enabled;
}
