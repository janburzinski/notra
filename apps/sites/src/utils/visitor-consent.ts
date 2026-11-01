import { readRequestConsent } from "@c15t/core/server";
import { C15T_ANALYTICS_CATEGORY } from "@notra/sites-core/constants/integrations";
import type { SiteManifest } from "@notra/sites-core/types/deployment";

export function visitorConsent(
  manifest: SiteManifest,
  headers: Headers
): boolean | undefined {
  if (manifest.analyticsConsent !== true) {
    return undefined;
  }
  const { state } = readRequestConsent({
    adapter: "@notra/sites",
    request: { headers },
    storage: { storageKey: manifest.consentStorageKey },
  });
  return (
    state.initialRecords?.choice?.categories[C15T_ANALYTICS_CATEGORY]?.value ===
    true
  );
}
