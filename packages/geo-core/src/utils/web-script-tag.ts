import type { GeoWebScript } from "../types/geo";

/**
 * The install tag. Pinned by default, it loads one build checked against its
 * integrity hash, so a changed file on the script host never runs on the
 * customer's pages; that needs `crossorigin` and never picks up a newer build.
 */
export function geoWebScriptTag(
  webKey: string,
  script: GeoWebScript,
  pinned = true
): string {
  const api = script.collectUrl ? ` data-api="${script.collectUrl}"` : "";
  return pinned
    ? `<script defer src="${script.pinnedUrl}" data-key="${webKey}"${api} integrity="${script.integrity}" crossorigin="anonymous"></script>`
    : `<script defer src="${script.url}" data-key="${webKey}"${api}></script>`;
}
