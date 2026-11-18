import type { Messages } from "use-intl";

import type { LandingLocale } from "@/types/i18n";

const catalogs = new Map<LandingLocale, Messages>();
const pending = new Map<LandingLocale, Promise<Messages>>();

async function importCatalog(locale: LandingLocale): Promise<Messages> {
  return locale === "de"
    ? (await import("../../../messages/de.json")).default
    : (await import("../../../messages/en.json")).default;
}

export function getCatalog(locale: LandingLocale) {
  return catalogs.get(locale);
}

export function loadCatalog(locale: LandingLocale) {
  const existing = pending.get(locale);
  if (existing) {
    return existing;
  }
  const request = importCatalog(locale).then(
    (catalog) => {
      catalogs.set(locale, catalog);
      return catalog;
    },
    (error: unknown) => {
      pending.delete(locale);
      throw error;
    }
  );
  pending.set(locale, request);
  return request;
}
