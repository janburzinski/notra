/** The same hostname with or without a leading "www.". */
export function wwwTwin(hostname: string): string {
  return hostname.startsWith("www.")
    ? hostname.slice("www.".length)
    : `www.${hostname}`;
}

/**
 * The hostname's www twin when the response redirects there over HTTPS, as an
 * apex that forwards to www (or the reverse) does. Any other redirect is null.
 */
export function redirectedWwwTwin(
  response: Response,
  url: string,
  hostname: string
): string | null {
  if (response.status < 300 || response.status >= 400) {
    return null;
  }
  const location = response.headers.get("location");
  if (!location) {
    return null;
  }
  let target: URL;
  try {
    target = new URL(location, url);
  } catch {
    return null;
  }
  const twin = wwwTwin(hostname);
  return target.protocol === "https:" && target.hostname === twin ? twin : null;
}
