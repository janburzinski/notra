import { sha256Hex } from "./hash";

/** Public by design: search engines read it back from the site to verify a submission. */
export function indexNowKey(siteId: string): Promise<string> {
  return sha256Hex(
    Uint8Array.from(new TextEncoder().encode(`indexnow:${siteId}`))
  );
}
