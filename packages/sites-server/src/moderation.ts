import { moderateSiteName } from "@notra/ai/jobs/site-name-moderation";
import { db } from "@notra/db/drizzle";
import {
  members,
  organizations,
  siteDomains,
  siteSlugGrants,
  users,
} from "@notra/db/schema";
import { and, eq, isNull, ne, or } from "drizzle-orm";

import {
  SITE_NAME_REJECTION_MESSAGES,
  SITE_PROTECTED_SLUG_WORDS,
  SITE_RESERVED_BRAND_SLUGS,
  SITE_SIGN_IN_SLUG_WORDS,
} from "./constants/moderation";
import { SITE_SLUG_RETIRED_NOTE } from "./constants/sites";
import { SiteInputError } from "./errors/sites";
import type {
  SiteNameRejection,
  SiteNameRejectionParams,
  SiteOrganizationOwnership,
} from "./types/sites";
import {
  ownershipEmailDomain,
  ownsBrandDomain,
  reservedSlugMessage,
  slugContainsWord,
} from "./utils/moderation";

/**
 * What Notra verified an organization owns: its members' verified work email
 * domains, custom domains it proved with a DNS record, and staff grants.
 */
export async function siteOrganizationOwnership(
  organizationId: string
): Promise<SiteOrganizationOwnership> {
  const [emails, hostnames, grants] = await Promise.all([
    db
      .select({ email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          eq(members.organizationId, organizationId),
          eq(users.emailVerified, true)
        )
      ),
    db
      .select({ hostname: siteDomains.hostname })
      .from(siteDomains)
      .where(
        and(
          eq(siteDomains.organizationId, organizationId),
          eq(siteDomains.kind, "subdomain"),
          eq(siteDomains.status, "active")
        )
      ),
    db
      .select({ slug: siteSlugGrants.slug })
      .from(siteSlugGrants)
      .where(
        and(
          eq(siteSlugGrants.organizationId, organizationId),
          or(
            isNull(siteSlugGrants.note),
            ne(siteSlugGrants.note, SITE_SLUG_RETIRED_NOTE)
          )
        )
      ),
  ]);
  const domains = [
    ...emails.map(({ email }) => ownershipEmailDomain(email)),
    ...hostnames.map(({ hostname }) => hostname),
  ].filter((domain): domain is string => domain !== null);
  return {
    domains: [...new Set(domains)].sort(),
    grantedSlugs: grants.map(({ slug }) => slug).sort(),
  };
}

/** Why the organization can't use this address, or null when it can. */
export async function siteSlugRejection(
  slug: string,
  organizationId: string,
  ownership: SiteOrganizationOwnership
): Promise<string | null> {
  const grant = await db.query.siteSlugGrants.findFirst({
    columns: { organizationId: true, note: true },
    where: eq(siteSlugGrants.slug, slug),
  });
  if (grant && grant.organizationId !== organizationId) {
    return SITE_NAME_REJECTION_MESSAGES.granted;
  }
  // Staff grants are trusted outright. A slug kept after deleting a site
  // only keeps other organizations out; it gets every check a free slug gets.
  if (grant && grant.note !== SITE_SLUG_RETIRED_NOTE) {
    return null;
  }
  if (slugContainsWord(slug, SITE_PROTECTED_SLUG_WORDS)) {
    return SITE_NAME_REJECTION_MESSAGES.protected;
  }
  if (slugContainsWord(slug, SITE_SIGN_IN_SLUG_WORDS)) {
    return SITE_NAME_REJECTION_MESSAGES.signIn;
  }
  const brandDomains = Object.hasOwn(SITE_RESERVED_BRAND_SLUGS, slug)
    ? SITE_RESERVED_BRAND_SLUGS[slug]
    : undefined;
  if (brandDomains && !ownsBrandDomain(ownership.domains, brandDomains)) {
    return reservedSlugMessage(slug, brandDomains);
  }
  return null;
}

async function siteNameRejection(
  params: SiteNameRejectionParams
): Promise<SiteNameRejection | null> {
  const ownership = await siteOrganizationOwnership(params.organizationId);
  if (params.slug) {
    const message = await siteSlugRejection(
      params.slug,
      params.organizationId,
      ownership
    );
    if (message) {
      return { message, field: "slug" };
    }
  }
  const organization = await db.query.organizations.findFirst({
    columns: { name: true },
    where: eq(organizations.id, params.organizationId),
  });
  const verdict = await moderateSiteName({
    organizationId: params.organizationId,
    organizationName: organization?.name ?? "",
    verifiedBrands: [...ownership.domains, ...ownership.grantedSlugs],
    name: params.name,
    address: params.address,
  });
  return verdict
    ? { message: SITE_NAME_REJECTION_MESSAGES[verdict], field: "name" }
    : null;
}

export async function assertSiteNameAllowed(
  params: SiteNameRejectionParams
): Promise<void> {
  const rejection = await siteNameRejection(params);
  if (rejection) {
    throw new SiteInputError(rejection.message, { field: rejection.field });
  }
}
