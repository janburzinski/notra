import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

import databasePath from "@ip-location-db/dbip-country-mmdb/dbip-country.mmdb" with { type: "file" };
import { Reader } from "mmdb-lib";

import type { CountryRecord } from "../types/country";

let reader: Reader<CountryRecord> | null | undefined;

/**
 * ISO country of an IP from the bundled DB-IP Lite database (CC BY 4.0).
 * The lookup runs in process, so visitor IPs never leave the service; the
 * 8 MB database loads on first use and a lookup takes about a microsecond.
 */
export function lookupCountry(ip: string): string | undefined {
  if (reader === undefined) {
    try {
      // Bundles reference the copied asset relative to themselves, not the cwd.
      const path = isAbsolute(databasePath)
        ? databasePath
        : join(import.meta.dir, databasePath);
      reader = new Reader<CountryRecord>(readFileSync(path));
    } catch (error) {
      console.error("[geo-ingest] Country database failed to load", error);
      reader = null;
    }
  }
  try {
    return reader?.get(ip)?.country_code;
  } catch {
    return undefined;
  }
}
