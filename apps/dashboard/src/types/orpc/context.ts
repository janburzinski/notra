import type {
  AuthIdentity,
  OrganizationMembership,
} from "@/types/auth/organization";
import type { GeoShelfMember } from "@/types/geo-shelf";

export interface ORPCRequestMemo {
  authenticatedUserId?: string;
  /** Membership-verified targets across all procedures in this HTTP request. */
  readonly authorizedOrganizationIds: Set<string>;
  readonly shelfMembersByOrganization: Map<string, Promise<GeoShelfMember[]>>;
  readonly analyticsEnabledByOrganization: Map<string, Promise<boolean>>;
  readonly geoEntitlementByOrganization: Map<
    string,
    Promise<"entitled" | "denied" | "skipped">
  >;
  /** Keyed by `${userId}:${organizationId}`. */
  readonly membershipByUserOrganization: Map<
    string,
    Promise<OrganizationMembership | undefined>
  >;
  /**
   * React `cache()` does not memoize inside route handlers, so without this
   * every procedure in a batch re-ran the WorkOS session read and the `users`
   * lookup.
   */
  identityLookup?: Promise<AuthIdentity>;
}

export interface ORPCContext {
  headers: Headers;
  requestMemo: ORPCRequestMemo;
  user: AuthIdentity["user"] | null;
}
