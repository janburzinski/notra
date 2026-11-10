import type { getServerIdentity } from "@/lib/auth/session";

export type AuthIdentity = Awaited<ReturnType<typeof getServerIdentity>>;

export type User = NonNullable<AuthIdentity["user"]>;

export type AuthenticatedUser = User;

export interface OrganizationMembership {
  id: string;
  role: string;
}

/** A membership a page loader already resolved for the signed-in user. */
export type LoadedMembership = OrganizationMembership & { userId: string };

export interface OrganizationAuthDependencies {
  getServerIdentity: typeof getServerIdentity;
  findMembership: (params: {
    organizationId: string;
    userId: string;
  }) => Promise<OrganizationMembership | undefined>;
  hasDatabaseUrl: () => boolean;
}

interface OrganizationContext {
  user: User;
  organizationId: string;
  membership: {
    id: string;
    role: string;
  };
}

interface OrganizationAuthResult {
  success: true;
  context: OrganizationContext;
}

interface OrganizationAuthError {
  success: false;
  response: Response;
}

export type OrganizationAuth = OrganizationAuthResult | OrganizationAuthError;
