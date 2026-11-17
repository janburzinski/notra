import "@tanstack/react-start/server-only";
import { listPaidOrganizationPlans } from "@notra/ai/billing/plan";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  freeScanClaims,
  members,
  organizationNotificationSettings,
  users,
} from "@notra/db/schema";
import { BREW_SIGNED_UP_TRIGGER } from "@notra/email/constants/brew";
import type { BrewContactInput } from "@notra/email/types/brew";
import {
  deleteBrewContact,
  fireBrewTrigger,
  isBrewConfigured,
  listBrewContacts,
  upsertBrewContacts,
} from "@notra/email/utils/brew";
import { and, type AnyColumn, eq, inArray, sql } from "drizzle-orm";

import {
  BREW_CONTACTS_LOGGED_ERROR_LIMIT,
  BREW_CONTACTS_MAX_PRUNE_RATIO,
  BREW_CONTACTS_PRUNE_FLOOR,
  BREW_PLAN_TIERS,
} from "@/constants/email/brew-contacts";

const WHITESPACE_REGEX = /\s+/;

function ownedOrganizationsWith(column: AnyColumn, missingRowDefault: boolean) {
  return sql<boolean>`coalesce(bool_or(${members.role} = 'owner' and coalesce(${column}, ${sql.raw(String(missingRowDefault))})), false)`;
}

function splitName(name: string, email: string) {
  if (name === email || name === email.split("@")[0]) {
    return {};
  }

  const [firstName, ...rest] = name.trim().split(WHITESPACE_REGEX);
  return { firstName, lastName: rest.join(" ") };
}

function toPlanTier(planId: string) {
  return (
    BREW_PLAN_TIERS.find((tier) => planId.split("_")[0] === tier) ?? "free"
  );
}

function highestPlanTier(
  organizationIds: string[],
  paidOrganizationPlans: Map<string, string>
) {
  let rank = 0;
  for (const id of organizationIds) {
    const planId = paidOrganizationPlans.get(id);
    if (planId) {
      rank = Math.max(rank, BREW_PLAN_TIERS.indexOf(toPlanTier(planId)));
    }
  }
  return BREW_PLAN_TIERS[rank];
}

/** Billing lives in Autumn; on failure `isPaying` and `plan` are left out. */
async function loadPaidOrganizationPlans() {
  try {
    return await listPaidOrganizationPlans();
  } catch (error) {
    logError("[BrewContacts] Paid plan lookup failed", error);
    return null;
  }
}

async function loadContacts(userIds?: string[]): Promise<BrewContactInput[]> {
  const paidOrganizationPlans = await loadPaidOrganizationPlans();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      marketingOptInAt: users.marketingOptInAt,
      marketingOptInEvidence: users.marketingOptInEvidence,
      marketingOptInPolicyVersion: users.marketingOptInPolicyVersion,
      dailySummaryEmails: ownedOrganizationsWith(
        organizationNotificationSettings.dailySummary,
        true
      ),
      contentCreatedEmails: ownedOrganizationsWith(
        organizationNotificationSettings.scheduledContentCreation,
        false
      ),
      contentFailedEmails: ownedOrganizationsWith(
        organizationNotificationSettings.scheduledContentFailed,
        false
      ),
      contentSkippedEmails: ownedOrganizationsWith(
        organizationNotificationSettings.scheduledContentSkipped,
        false
      ),
      autopilotDraftsEmails: ownedOrganizationsWith(
        organizationNotificationSettings.autopilotDrafts,
        true
      ),
      freeScanClaimed: sql<boolean>`coalesce(bool_or(exists(select 1 from ${freeScanClaims} where ${freeScanClaims.organizationId} = ${members.organizationId} and ${freeScanClaims.claimedAt} is not null and ${freeScanClaims.revokedAt} is null)), false)`,
      organizationIds: sql<
        string[]
      >`coalesce(array_agg(distinct ${members.organizationId}) filter (where ${members.organizationId} is not null), '{}')`,
    })
    .from(users)
    .leftJoin(members, eq(members.userId, users.id))
    .leftJoin(
      organizationNotificationSettings,
      eq(
        organizationNotificationSettings.organizationId,
        members.organizationId
      )
    )
    .where(userIds ? inArray(users.id, userIds) : undefined)
    .groupBy(users.id);

  return rows.map(
    ({
      id,
      email,
      name,
      createdAt,
      marketingOptInAt,
      marketingOptInEvidence,
      marketingOptInPolicyVersion,
      organizationIds,
      ...preferences
    }) => ({
      email,
      ...splitName(name, email),
      customFields: {
        notraUserId: id,
        signedUpAt: createdAt.toISOString(),
        marketingEmails: marketingOptInAt !== null,
        ...preferences,
        ...(paidOrganizationPlans && {
          isPaying: organizationIds.some((id) => paidOrganizationPlans.has(id)),
          plan: highestPlanTier(organizationIds, paidOrganizationPlans),
        }),
      },
      ...(marketingOptInAt &&
        marketingOptInEvidence &&
        marketingOptInPolicyVersion && {
          consent: {
            source: "form" as const,
            capturedAt: marketingOptInAt.toISOString(),
            policyVersion: marketingOptInPolicyVersion,
            evidence: marketingOptInEvidence,
          },
        }),
    })
  );
}

/** Upserts the given users, or every user when called without ids. */
export async function syncBrewContacts(userIds?: string[]) {
  if (!isBrewConfigured() || userIds?.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const contacts = await loadContacts(userIds);
  const { failed, errors } = await upsertBrewContacts(contacts);

  if (errors.length > 0) {
    logError("[BrewContacts] Upsert failed", undefined, {
      failed,
      errors: errors.slice(0, BREW_CONTACTS_LOGGED_ERROR_LIMIT),
    });
  }

  return { synced: contacts.length - failed, failed };
}

/**
 * Syncs a new user's contact, then starts the Brew onboarding sequence. The
 * contact goes first because the sequence reads its fields.
 */
export async function startBrewOnboarding({
  userId,
  slackInvited,
}: {
  userId: string;
  slackInvited: boolean;
}) {
  if (!isBrewConfigured()) {
    return;
  }

  const [contact] = await loadContacts([userId]);
  if (!contact) {
    return;
  }

  const { errors } = await upsertBrewContacts([contact]);
  if (errors.length > 0) {
    logError("[BrewContacts] Upsert failed", undefined, { errors });
  }

  const result = await fireBrewTrigger(
    BREW_SIGNED_UP_TRIGGER,
    { email: contact.email, firstName: contact.firstName, slackInvited },
    { scope: "signed-up", idempotencyKey: userId }
  );
  if (!result.ok) {
    throw new Error(`${result.error.name}: ${result.error.message}`);
  }
}

/**
 * Deletes Brew contacts whose Notra user no longer exists, catching account
 * deletions whose immediate Brew delete failed. Contacts Brew got from
 * anywhere else (no `notraUserId`) are left alone.
 */
export async function pruneBrewContacts() {
  if (!isBrewConfigured()) {
    return { pruned: 0 };
  }

  const listed = await listBrewContacts();
  if (!listed.ok) {
    throw new Error(`Failed to list Brew contacts: ${listed.error.message}`);
  }

  const synced = listed.data.filter(
    (contact) => contact.customFields?.notraUserId
  );
  const userIds = synced.map(
    (contact) => contact.customFields?.notraUserId ?? ""
  );
  const existing = new Set(
    userIds.length === 0
      ? []
      : (
          await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, userIds))
        ).map((user) => user.id)
  );
  const orphans = synced.filter(
    (contact) => !existing.has(contact.customFields?.notraUserId ?? "")
  );

  const pruneLimit = Math.max(
    BREW_CONTACTS_PRUNE_FLOOR,
    synced.length * BREW_CONTACTS_MAX_PRUNE_RATIO
  );
  if (orphans.length > pruneLimit) {
    throw new Error(
      `Refusing to prune ${orphans.length} of ${synced.length} Brew contacts`
    );
  }

  for (const contact of orphans) {
    await deleteBrewContact(contact.email);
  }

  return { pruned: orphans.length };
}

export async function syncBrewContactsForOrganizationOwners(
  organizationId: string
) {
  const owners = await db
    .select({ userId: members.userId })
    .from(members)
    .where(
      and(eq(members.organizationId, organizationId), eq(members.role, "owner"))
    );

  return syncBrewContacts(owners.map((owner) => owner.userId));
}
