import { os } from "@orpc/server";

import { getTranslations } from "@/lib/i18n/server";
import { forbidden } from "@/lib/orpc/utils/errors";
import { isWebAnalyticsEnabled } from "@/lib/web-analytics/flag";
import type { ORPCContext } from "@/types/orpc/context";

/** Call after the membership check, so the flag never leaks to non-members. */
export async function assertWebAnalyticsEnabled(
  organizationId: string,
  headers?: Headers
): Promise<void> {
  if (!(await isWebAnalyticsEnabled(organizationId, headers))) {
    const t = await getTranslations("errors.webAnalytics");
    throw forbidden(t("unavailable"));
  }
}

/** Use after `withOrganizationAccess`. */
export const withWebAnalyticsFlag = os
  .$context<ORPCContext>()
  .middleware(async ({ context, next }, input: { organizationId: string }) => {
    await assertWebAnalyticsEnabled(input.organizationId, context.headers);
    return next();
  });
