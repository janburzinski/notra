import {
  CONTEXT_DOMAIN_LOGO_BASE_URL,
  DUCKDUCKGO_FAVICON_BASE_URL,
} from "@/constants/domain-logo";

const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
const URL_SCHEME_REGEX = /^[a-z][a-z\d+.-]*:\/\//i;
const TRAILING_DOT_REGEX = /\.$/;

export function normalizeDomain(
  value: string | null | undefined
): string | null {
  const input = value?.trim();
  if (!input) {
    return null;
  }
  if (URL_SCHEME_REGEX.test(input) && !HTTP_PROTOCOL_REGEX.test(input)) {
    return null;
  }

  try {
    const url = new URL(
      HTTP_PROTOCOL_REGEX.test(input) ? input : `https://${input}`
    );
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.hostname.toLowerCase().replace(TRAILING_DOT_REGEX, "") || null;
  } catch {
    return null;
  }
}

export function getDomainLogoSources(
  value: string | null | undefined,
  preferredSources: readonly (string | null | undefined)[] = []
): string[] {
  const sources = preferredSources.flatMap((source) => {
    const normalizedSource = source?.trim();
    return normalizedSource ? [normalizedSource] : [];
  });
  const domain = normalizeDomain(value);

  if (domain) {
    const clientId = process.env.NEXT_PUBLIC_LOGOLINK_CLIENT_ID;
    if (clientId) {
      const contextLogoUrl = new URL(CONTEXT_DOMAIN_LOGO_BASE_URL);
      contextLogoUrl.searchParams.set("publicClientId", clientId);
      contextLogoUrl.searchParams.set("domain", domain);
      sources.push(contextLogoUrl.toString());
    }

    sources.push(
      `${DUCKDUCKGO_FAVICON_BASE_URL}/${encodeURIComponent(domain)}.ico`
    );
  }

  return [...new Set(sources)];
}
