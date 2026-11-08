import type { SITES_API_FORWARDED_STATUSES } from "../constants/sites";

export type SitesForwardedStatus =
  (typeof SITES_API_FORWARDED_STATUSES)[number];

export interface SitesFailure {
  status: SitesForwardedStatus | 502 | 504;
  error: string;
}
