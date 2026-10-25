import type {
  SITE_DEPLOYMENT_STATUSES,
  SITE_SUSPENDERS,
} from "@notra/sites-core/constants/sites";

export type SiteDeploymentStatus = (typeof SITE_DEPLOYMENT_STATUSES)[number];
export type SiteSuspender = (typeof SITE_SUSPENDERS)[number];
