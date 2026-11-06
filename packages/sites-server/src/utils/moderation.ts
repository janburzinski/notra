import { SITE_FREE_EMAIL_DOMAINS } from "../constants/moderation";

export function reservedSlugMessage(
  slug: string,
  domains: readonly string[]
): string {
  const [domain] = domains;
  if (!domain) {
    return `${slug} is reserved. Contact support or pick another address.`;
  }
  return `${slug} is reserved for ${domain}. Invite a teammate with a verified @${domain} email or verify a ${domain} custom domain on one of your sites to use it, contact support, or pick another address.`;
}

/** Whether a dash-separated slug contains one of the words or phrases as whole words. */
export function slugContainsWord(
  slug: string,
  words: ReadonlySet<string>
): boolean {
  return [...words].some((word) => `-${slug}-`.includes(`-${word}-`));
}

/**
 * Drops whole words and phrases from a dash-separated slug. Removing one can
 * join its neighbours into another (log-sign-in-in becomes log-in), so it
 * repeats until nothing changes.
 */
export function slugWithoutWords(
  slug: string,
  words: ReadonlySet<string>
): string {
  let padded = `-${slug}-`;
  let previous = "";
  while (padded !== previous) {
    previous = padded;
    for (const word of words) {
      padded = padded.replaceAll(`-${word}-`, "-");
    }
  }
  return padded.replace(/^-+|-+$/g, "");
}

/**
 * The domain of a verified address, unless anyone can sign up there or at a
 * parent domain (mail.yahoo.co.jp is as public as yahoo.co.jp).
 */
export function ownershipEmailDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return null;
  }
  const labels = domain.split(".");
  const isPublic = labels.some((_, start) =>
    SITE_FREE_EMAIL_DOMAINS.has(labels.slice(start).join("."))
  );
  return isPublic ? null : domain;
}

export function ownsBrandDomain(
  ownedDomains: readonly string[],
  brandDomains: readonly string[]
): boolean {
  return ownedDomains.some((owned) =>
    brandDomains.some((brand) => owned === brand || owned.endsWith(`.${brand}`))
  );
}
