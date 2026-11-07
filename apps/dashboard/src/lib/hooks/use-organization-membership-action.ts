"use client";

import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { Organization } from "@/components/providers/organization-provider";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "@/lib/navigation";
import type { OrganizationMembershipAction } from "@/lib/organizations/membership-action";
import { dashboardOrpc } from "@/lib/orpc/query";
import { setLastVisitedOrganization } from "@/utils/cookies";
import { QUERY_KEYS } from "@/utils/query-keys";

export function useOrganizationMembershipAction(
  organization: Organization | null | undefined,
  hasOtherMembers: boolean
) {
  const tSettingsShared = useTranslations("settings.shared");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function applyAction(action: OrganizationMembershipAction) {
    if (!organization) {
      return;
    }

    setIsPending(true);

    const successMessage =
      action === "delete"
        ? tSettingsShared("deletedName", { name: organization.name })
        : tSettingsShared("leftName", { name: organization.name });

    try {
      await dashboardOrpc.user.membership.applyAction.call({
        organizationId: organization.id,
        action,
      });

      if (action === "delete") {
        trackEvent(POSTHOG_EVENTS.ORGANIZATION_DELETED, {
          deleted_organization_id: organization.id,
          had_other_members: hasOtherMembers,
          had_paid_history: null,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.AUTH.organizations,
      });
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.user.organizations.listOwned.queryKey(),
      });

      const freshOrgs = await queryClient.fetchQuery({
        queryKey: QUERY_KEYS.AUTH.organizations,
        queryFn: async () => {
          const result = await authClient.organization.list();
          return result.data ?? [];
        },
      });

      toast.success(successMessage);

      const firstOrg = freshOrgs[0];
      if (!firstOrg) {
        router.push("/onboarding");
        return;
      }

      await authClient.organization.setActive({
        organizationId: firstOrg.id,
      });
      await setLastVisitedOrganization(firstOrg.slug);
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.AUTH.activeOrganization,
      });

      router.push(`/${firstOrg.slug}?settings=account`);
    } catch (error) {
      toast.error(tSettingsShared("failedToUpdateOrganizationMembership"));
      console.error(error);
    }
    setIsPending(false);
  }

  return { applyAction, isPending };
}
