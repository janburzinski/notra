import type { siteDomains } from "@notra/db/schema";
import type { SiteDomainVerificationRecord } from "@notra/db/types/sites";

import type { R2TextObject } from "./r2";
import type { Site } from "./sites";

export type SiteDomain = typeof siteDomains.$inferSelect;

export interface AddSiteDomainInput {
  kind: SiteDomain["kind"];
  value: string;
}

export interface DomainCheck {
  verified: boolean;
  lastError: string | null;
  records: SiteDomainVerificationRecord[];
}

export interface ProxyProbe {
  /** Why the domain does not serve the site yet, or null when it does. */
  problem: string | null;
  /** The www twin the probe redirected to, so the domain can move there. */
  wwwTwin: string | null;
}

export interface DomainRecheckWindow {
  /** Domains that never verified and were created after this; null for domains that worked before. */
  createdAfter: Date | null;
  /** Due when not checked since this. */
  checkedBefore: Date;
}

export interface SiteDomainRecheck {
  site: Site;
  result: RefreshSiteDomainResult;
}

export interface RefreshSiteDomainResult {
  domain: SiteDomain;
  /** True only on the check that first verified this domain. */
  newlyVerified: boolean;
  rebuildJobId: string | null;
}

export interface VerifiedHostClaim {
  current: R2TextObject | null;
  owner: SiteDomain | null;
}
