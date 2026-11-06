export interface ModerateSiteNameParams {
  organizationId: string;
  organizationName: string;
  /** Domains and addresses Notra verified the organization owns. */
  verifiedBrands: readonly string[];
  name: string;
  address: string;
}

export type SiteNameModerationVerdict = "offensive" | "impersonation" | null;
