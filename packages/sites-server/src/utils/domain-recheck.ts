import {
  DOMAIN_FAILED_RECHECK_MS,
  DOMAIN_RECHECK_SCHEDULE,
} from "../constants/domains";
import type { DomainRecheckWindow } from "../types/domains";

/**
 * When a domain is due for an automatic check: a domain that worked before is
 * checked hourly, a new one on DOMAIN_RECHECK_SCHEDULE by its age.
 */
export function domainRecheckWindows(now: Date): DomainRecheckWindow[] {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  return [
    { createdAfter: null, checkedBefore: ago(DOMAIN_FAILED_RECHECK_MS) },
    ...DOMAIN_RECHECK_SCHEDULE.map(({ untilAgeMs, everyMs }) => ({
      createdAfter: ago(untilAgeMs),
      checkedBefore: ago(everyMs),
    })),
  ];
}
