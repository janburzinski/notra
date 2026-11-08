import { ORGANIZATION_MANAGER_ROLES } from "@/constants/organization-roles";

export function isOrganizationManager(role: string): boolean {
  return ORGANIZATION_MANAGER_ROLES.has(role);
}
