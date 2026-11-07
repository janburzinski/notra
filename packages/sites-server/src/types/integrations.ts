import type { SiteIntegrations } from "@notra/sites-core/types/site-integrations";

export interface SiteIntegrationConfigUpdate {
  provider: keyof SiteIntegrations;
  settings: Record<string, unknown> | null;
}

export interface SiteIntegrationsState {
  integrations: Record<string, unknown>;
  invalid: boolean;
}

export interface SiteIntegrationPullRequest {
  /** Null when blog.json already holds the change. */
  pullRequestUrl: string | null;
}
