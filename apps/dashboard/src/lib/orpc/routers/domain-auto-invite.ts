import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { organizationIdInputSchema } from "@notra/schemas/dashboard/auth/organization";
import { updateDomainAutoInviteInputSchema } from "@notra/schemas/dashboard/domain-auto-invite";
import { isDemoMode } from "@notra/utils/demo-mode";
import { eq } from "drizzle-orm";

import { ORGANIZATION_MANAGER_ROLES } from "@/constants/organization-roles";
import { getTranslations } from "@/lib/i18n/server";
import {
  autoInviteDomainFor,
  setAutoInviteDomain,
} from "@/lib/organizations/domain-invites";
import { authorizedProcedure, withOrganizationAccess } from "@/lib/orpc/base";
import type {
  DomainAutoInviteState,
  EmailIdentity,
} from "@/types/organizations/domain-auto-invite";

import { assertNotDemo, badRequest, forbidden } from "../utils/errors";

async function readState(
  organizationId: string,
  user: EmailIdentity,
  role: string
): Promise<DomainAutoInviteState> {
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { autoInviteDomain: true },
  });
  return {
    enabledDomain: organization?.autoInviteDomain ?? null,
    eligibleDomain: autoInviteDomainFor(user),
    canManage: !isDemoMode() && ORGANIZATION_MANAGER_ROLES.has(role),
  };
}

export const domainAutoInviteRouter = {
  get: authorizedProcedure
    .input(organizationIdInputSchema)
    .use(withOrganizationAccess)
    .handler(({ context, input }) =>
      readState(
        input.organizationId,
        context.auth.user,
        context.auth.membership.role
      )
    ),
  update: authorizedProcedure
    .input(updateDomainAutoInviteInputSchema)
    .use(withOrganizationAccess)
    .handler(async ({ context, input }) => {
      assertNotDemo();
      const t = await getTranslations("errors.domainAutoInvite");
      if (!ORGANIZATION_MANAGER_ROLES.has(context.auth.membership.role)) {
        throw forbidden(t("managersOnly"));
      }
      const domain = autoInviteDomainFor(context.auth.user);
      if (input.enabled && !domain) {
        throw badRequest(t("noCompanyDomain"));
      }
      await setAutoInviteDomain(
        input.organizationId,
        input.enabled ? domain : null
      );
      return await readState(
        input.organizationId,
        context.auth.user,
        context.auth.membership.role
      );
    }),
};
