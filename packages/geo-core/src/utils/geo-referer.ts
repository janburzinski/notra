export function sanitizeGeoReferer(value: string | undefined): string {
  if (!value) {
    return "";
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

/** The referrer's origin alone, for referrers a browser reported. */
export function sanitizeGeoRefererOrigin(value: string | undefined): string {
  const referer = sanitizeGeoReferer(value);
  return referer ? new URL(referer).origin : "";
}
