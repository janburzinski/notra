const BASE = "http://local";

/**
 * Only same-site paths, so the sign-in flow can't be used to bounce people elsewhere. Checked after
 * URL normalisation: `/.//evil.com` resolves to `//evil.com`, which a browser reads as another host.
 */
export function safeReturnPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.includes("\\")) {
    return "/";
  }
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE || url.pathname.startsWith("//")) {
      return "/";
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

export function withAuthResult(path: string, result: string) {
  const url = new URL(safeReturnPath(path), BASE);
  url.searchParams.set("auth", result);
  return `${url.pathname}${url.search}`;
}
