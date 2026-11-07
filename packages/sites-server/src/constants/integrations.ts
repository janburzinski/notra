import type { SiteIntegrations } from "@notra/sites-core/types/site-integrations";

export const SITE_INTEGRATION_NAMES: Record<keyof SiteIntegrations, string> = {
  capless: "Capless",
  databuddy: "Databuddy",
  ga4: "Google Analytics 4",
  plausible: "Plausible",
  posthog: "PostHog",
  umami: "Umami",
  c15t: "c15t cookie banner",
};

export const SITE_INTEGRATION_BRANCH_PREFIX = "notra/integrations-";

export const SITE_INTEGRATION_PULL_REQUEST_BODY = "Opened from Notra.";
