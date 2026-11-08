import { isWebAnalyticsEnabledForOrganization } from "@notra/ai/utils/web-analytics-access";

import { getORPCRequestMemo } from "@/lib/orpc/context";

/** The shared web analytics flag, evaluated once per organization per request. */
export function isWebAnalyticsEnabled(
  organizationId: string,
  headers?: Headers
): Promise<boolean> {
  const memo = headers ? getORPCRequestMemo(headers) : undefined;
  let enabled = memo?.webAnalyticsEnabledByOrganization.get(organizationId);
  if (!enabled) {
    enabled = isWebAnalyticsEnabledForOrganization(organizationId);
    memo?.webAnalyticsEnabledByOrganization.set(organizationId, enabled);
  }
  return enabled;
}
