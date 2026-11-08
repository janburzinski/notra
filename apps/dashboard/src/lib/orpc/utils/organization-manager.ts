import { forbidden } from "@/lib/orpc/utils/errors";
import { isOrganizationManager } from "@/utils/organization-roles";

/** Throws unless the member is an owner or admin of the organization. */
export function assertOrganizationManager(
  membership: { role: string },
  action: string
): void {
  if (!isOrganizationManager(membership.role)) {
    throw forbidden(`Only organization owners and admins can ${action}`);
  }
}
