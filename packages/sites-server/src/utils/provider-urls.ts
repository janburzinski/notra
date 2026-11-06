import { BOX_BASE_URL } from "@notra/ai/constants/repo-image";
import type { SiteFontEndpoints } from "@notra/sites-core/types/fonts";

import { CLOUDFLARE_API_URL } from "../constants/domains";
import { VERCEL_API_URL } from "../constants/vercel-dns";

// Every external service the Sites backend calls. Each has an override the
// end-to-end suite points at its emulator (apps/sites-e2e/emulators);
// production leaves them unset and uses the real endpoint. Autumn (plan
// limits) goes through the shared client in packages/ai, overridden by
// AUTUMN_API_URL.
function override(name: string): string | undefined {
  return process.env[name]?.trim().replace(/\/+$/, "") || undefined;
}

export function r2Endpoint(accountId: string): string {
  return (
    override("SITES_R2_ENDPOINT") ??
    `https://${accountId}.r2.cloudflarestorage.com`
  );
}

export function cloudflareZonesApi(): string {
  return `${override("SITES_CLOUDFLARE_API_URL") ?? CLOUDFLARE_API_URL}/client/v4/zones`;
}

export function vercelApiUrl(): string {
  return override("SITES_VERCEL_API_URL") ?? VERCEL_API_URL;
}

/** Google Fonts' CSS API, font files and licenses on one emulator; undefined uses Google. */
export function googleFontsEndpoints(): SiteFontEndpoints | undefined {
  const base = override("SITES_GOOGLE_FONTS_URL");
  return base
    ? { css: `${base}/css2`, files: base, licenses: base }
    : undefined;
}

export function boxApiUrl(): string {
  return override("SITES_BOX_API_URL") ?? BOX_BASE_URL;
}

/** `host:port` resolvers for TXT/NS lookups; null keeps the default servers. */
export function dnsServersOverride(): string[] | null {
  const servers = override("SITES_DNS_SERVERS")
    ?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);
  return servers?.length ? servers : null;
}
