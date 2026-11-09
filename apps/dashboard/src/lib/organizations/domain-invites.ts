import { checkTeamMembersLimit } from "@notra/ai/billing/team-members";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { isDemoMode } from "@notra/utils/demo-mode";
import type { Invitation } from "@workos-inc/node";
import { getWorkOS } from "@workos/authkit-session";
import { eq, inArray } from "drizzle-orm";

import {
  ACADEMIC_DOMAIN_PATTERN,
  INVITATION_PAGE_SIZE,
} from "@/constants/domain-auto-invite";
import { redirect } from "@/lib/navigation";
import { resolveCompanyDomain } from "@/lib/onboarding/company-domain";
import type { EmailIdentity } from "@/types/organizations/domain-auto-invite";

function companyEmailDomain(email: string): string | null {
  const domain = resolveCompanyDomain({ email })?.domain ?? null;
  return domain && !ACADEMIC_DOMAIN_PATTERN.test(domain) ? domain : null;
}

function isExpired(invitation: Invitation): boolean {
  return (
    invitation.state === "expired" ||
    (invitation.state === "pending" &&
      new Date(invitation.expiresAt).getTime() <= Date.now())
  );
}

function isOpen(invitation: Invitation): boolean {
  return invitation.state === "pending" && !isExpired(invitation);
}

/** Every page, so a declined invitation is never mistaken for a missing one. */
async function listAllInvitations(email: string): Promise<Invitation[]> {
  const invitations: Invitation[] = [];
  let after: string | undefined;
  do {
    const page = await getWorkOS().userManagement.listInvitations({
      email,
      limit: INVITATION_PAGE_SIZE,
      after,
    });
    invitations.push(...page.data);
    after = page.listMetadata.after ?? undefined;
  } while (after);
  return invitations;
}

/**
 * The only domain an admin may open their workspace to: their own verified
 * company domain, so nobody can claim someone else's.
 */
export function autoInviteDomainFor(user: EmailIdentity): string | null {
  return user.emailVerified ? companyEmailDomain(user.email) : null;
}

export async function setAutoInviteDomain(
  organizationId: string,
  domain: string | null
) {
  await db
    .update(organizations)
    .set({ autoInviteDomain: domain })
    .where(eq(organizations.id, organizationId));
}

/**
 * Workspaces with a pending, accepted or declined (revoked) invitation for this
 * address are skipped, so repeating this never re-invites anyone. Only an
 * expired invitation is replaced.
 */
async function sendMissingDomainInvites(
  email: string,
  existing: Invitation[]
): Promise<Invitation[]> {
  const domain = companyEmailDomain(email);
  if (!domain) {
    return [];
  }
  const invited = new Set(
    existing
      .filter((invitation) => !isExpired(invitation))
      .map((invitation) => invitation.organizationId)
  );
  const matches = await db.query.organizations.findMany({
    where: eq(organizations.autoInviteDomain, domain),
    columns: { id: true, workosOrgId: true },
  });
  const sent = await Promise.all(
    matches.map(async (organization) => {
      if (
        !organization.workosOrgId ||
        invited.has(organization.workosOrgId) ||
        (await checkTeamMembersLimit(organization.id)) !== "allowed"
      ) {
        return null;
      }
      return await getWorkOS()
        .userManagement.sendInvitation({
          email,
          organizationId: organization.workosOrgId,
          roleSlug: "member",
        })
        .catch((error) => {
          logError("Failed to send domain auto-invite", error, {
            organizationId: organization.id,
          });
          return null;
        });
    })
  );
  return sent.filter((invitation) => invitation !== null);
}

/**
 * Sends any missing domain auto-invites and returns the token of the newest
 * open invitation to a workspace that still exists. Safe to repeat, which also
 * retries invites a WorkOS outage dropped.
 *
 * Unverified users are skipped: accepting requires a verified email, so they
 * would only be sent to an invitation they cannot accept.
 */
export async function ensureDomainInvitations(
  user: EmailIdentity
): Promise<string | null> {
  if (isDemoMode() || !user.emailVerified) {
    return null;
  }
  const existing = await listAllInvitations(user.email);
  const sent = await sendMissingDomainInvites(user.email, existing);
  const open = [...existing, ...sent].filter(isOpen);
  const workosOrgIds = open.flatMap((invitation) =>
    invitation.organizationId ? [invitation.organizationId] : []
  );
  if (workosOrgIds.length === 0) {
    return null;
  }
  const local = await db.query.organizations.findMany({
    where: inArray(organizations.workosOrgId, workosOrgIds),
    columns: { workosOrgId: true },
  });
  const known = new Set(local.map((organization) => organization.workosOrgId));
  const newest = open
    .filter((invitation) => known.has(invitation.organizationId))
    .toSorted(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  return newest[0]?.token ?? null;
}

/** Where a user without a workspace should go instead of onboarding, if anywhere. */
export async function pendingInvitationHref(
  user: EmailIdentity
): Promise<string | null> {
  const token = await ensureDomainInvitations(user).catch((error) => {
    logError("Failed to resolve pending invitations", error);
    return null;
  });
  return token
    ? `/invitation?${new URLSearchParams({ invitation_token: token })}`
    : null;
}

/** Sends a user without a workspace to their invitation instead of onboarding. */
export async function redirectToPendingInvitation(user: EmailIdentity) {
  const href = await pendingInvitationHref(user);
  if (href) {
    redirect(href);
  }
}
