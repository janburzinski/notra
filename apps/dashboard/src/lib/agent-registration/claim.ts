import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { getWorkOS } from "@workos/authkit-session";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { getLastActiveOrganization } from "@/lib/auth/actions";
import { readWorkOSError } from "@/lib/auth/workos-error";
import { ensureWorkOSOrganizationWithMembers } from "@/lib/organizations/workos-sync";
import type {
  AgentClaimFailureReason,
  AgentClaimPageData,
} from "@/types/agent-registration";
import type { SessionUser } from "@/types/auth/session";

function claimFailureReason(error: unknown): AgentClaimFailureReason {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : null;
  if (status === 410) {
    return "expired";
  }
  if (status === 409) {
    return "claimed";
  }
  if (status === 400) {
    return "mismatch";
  }
  return "failed";
}

export async function linkAgentClaim(
  claimAttemptToken: string,
  user: SessionUser
): Promise<AgentClaimPageData> {
  const active = await getLastActiveOrganization();
  if (!active) {
    return { status: "no-workspace" };
  }

  const [organization, workosOrgId] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, active.id),
      columns: { name: true },
    }),
    Effect.runPromise(ensureWorkOSOrganizationWithMembers(active.id)),
  ]);

  try {
    const claim = await getWorkOS().agents.linkClaimAttemptToExternalUser({
      claimAttemptToken,
      user: { email: user.email, externalId: user.id },
      organizationId: workosOrgId,
    });
    return {
      status: "linked",
      userCode: claim.userCode,
      workspaceName: organization?.name ?? active.slug,
    };
  } catch (error) {
    const reason = claimFailureReason(error);
    await Effect.runPromise(
      Effect.logWarning("Agent claim link failed").pipe(
        Effect.annotateLogs({
          userId: user.id,
          reason,
          error: readWorkOSError(error).message,
        })
      )
    );
    return { status: "unavailable", reason };
  }
}
