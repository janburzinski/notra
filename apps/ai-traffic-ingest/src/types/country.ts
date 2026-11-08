import type { CountryResponse } from "mmdb-lib";

/** ip-location-db records carry a flat ISO code next to the MaxMind shape. */
export type CountryRecord = CountryResponse & { country_code?: string };
