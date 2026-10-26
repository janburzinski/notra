import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { validateOrganizationAccess } from "@/lib/auth/actions";
import { isSitesEnabledForOrganization } from "@/lib/sites/flag";
import type { UiRouteInput } from "@/types/ui-route";

export const loadSitesEnabled = createServerFn({ method: "GET" })
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params } }) => {
    const { organization } = await validateOrganizationAccess(
      params.slug ?? ""
    );
    return isSitesEnabledForOrganization(organization.id);
  });

export const loadSite = createServerFn({
  method: "GET",
  strict: { output: false },
})
  .validator((data: UiRouteInput) => data)
  .handler(async ({ data: { params, searchParams } }) => {
    const { organization, user, member } = await validateOrganizationAccess(
      params.slug ?? ""
    );
    const { dehydrateSiteQueries } =
      await import("@/utils/site-prefetch.server");
    const branch = searchParams.branch;
    return {
      state: await dehydrateSiteQueries(
        organization.id,
        params.siteId ?? "",
        typeof branch === "string" && branch ? branch : undefined,
        getRequestHeaders(),
        member && { userId: user.id, id: member.id, role: member.role }
      ),
    };
  });
