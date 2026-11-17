import { isIP } from "node:net";

import { assertPublicHttpUrl } from "@notra/utils/url";
import { DOMAINS } from "free-email-domains-list";
import { isValid as isNotDisposableEmail } from "mailchecker";

import { WWW_PREFIX_PATTERN } from "@/constants/company-domain";
import type { CompanyDomainResolution } from "@/types/onboarding";

function extractDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const withProtocol = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    const hostname = new URL(withProtocol).hostname.replace(
      WWW_PREFIX_PATTERN,
      ""
    );
    if (!hostname.includes(".") || isIP(hostname) !== 0) {
      return null;
    }
    assertPublicHttpUrl(`https://${hostname}`);
    return hostname;
  } catch {
    return null;
  }
}

function isFreeEmailDomain(domain: string): boolean {
  return DOMAINS.has(domain.toLowerCase());
}

export function resolveCompanyDomain({
  websiteUrl,
  email,
}: {
  websiteUrl?: string;
  email?: string;
}): CompanyDomainResolution | null {
  const websiteDomain = websiteUrl ? extractDomain(websiteUrl) : null;
  if (websiteDomain && !isFreeEmailDomain(websiteDomain)) {
    return { domain: websiteDomain, source: "website" };
  }

  if (email && isNotDisposableEmail(email)) {
    const emailDomain = extractDomain(email.split("@").at(-1) ?? "");
    if (emailDomain && !isFreeEmailDomain(emailDomain)) {
      return { domain: emailDomain, source: "email" };
    }
  }

  return null;
}
