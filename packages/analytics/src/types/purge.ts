export interface PurgeSocialAccountInput {
  organizationId: string;
  provider: string;
  providerAccountId: string;
}

export interface PurgeGeoProjectInput {
  organizationId: string;
  projectId: string;
}

export interface PurgeImportedRowsInput {
  organizationId: string;
  importId: string;
  /** Inclusive YYYY-MM-DD bounds; omit both to delete the whole import. */
  fromDay?: string;
  toDay?: string;
}

export interface PurgeOrganizationInput {
  organizationId: string;
}

export interface PurgeSiteInput {
  organizationId: string;
  siteId: string;
}

export type DeletedAnalyticsPurgeInput = {
  organizationId: string;
  siteId?: string;
  projectId?: string;
};
