const LEADING_WWW_REGEX = /^www\./;

/** The domain an import of `host` writes: the host without www, plus its subdomains. */
export function importHostScope(host: string): string {
  return host.replace(LEADING_WWW_REGEX, "");
}

export function isInImportHostScope(host: string, scope: string): boolean {
  const bare = importHostScope(host);
  return bare === scope || bare.endsWith(`.${scope}`);
}

/** Whether imports of the two hosts can write rows for the same host. */
export function importHostScopesOverlap(left: string, right: string): boolean {
  const a = importHostScope(left);
  const b = importHostScope(right);
  return isInImportHostScope(a, b) || isInImportHostScope(b, a);
}
