import type { AnalyticsImportProvider } from "@notra/db/types/analytics-imports";

import { IMPORT_PROVIDERS } from "../constants/analytics-imports";
import type { ImportHostScope } from "../types/analytics-imports";

const LEADING_WWW_REGEX = /^www\./;

/** The domain an import of `host` writes: the host without www, plus its subdomains. */
export function importHostScope(host: string): string {
  return host.replace(LEADING_WWW_REGEX, "");
}

export function isInImportHostScope(host: string, scope: string): boolean {
  const bare = importHostScope(host);
  return bare === scope || bare.endsWith(`.${scope}`);
}

/** The hosts an import from `provider` into `host` can write rows for. */
export function providerHostScope(
  provider: AnalyticsImportProvider,
  host: string
): ImportHostScope {
  return { host, subdomains: IMPORT_PROVIDERS[provider].writesSubdomains };
}

/**
 * Whether two host scopes share a host. A scope without subdomains writes
 * only its host and www alias, so acme.dev and docs.acme.dev from two Vercel
 * projects never overlap, while a Plausible import of acme.dev covers both.
 */
export function importHostScopesOverlap(
  left: ImportHostScope,
  right: ImportHostScope
): boolean {
  const a = importHostScope(left.host);
  const b = importHostScope(right.host);
  return (
    a === b ||
    (left.subdomains && isInImportHostScope(b, a)) ||
    (right.subdomains && isInImportHostScope(a, b))
  );
}
