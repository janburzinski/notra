export const WEB_ANALYTICS_NAV_LINK = "/geo/traffic/web";

export const GEO_TRAFFIC_PAGE_KINDS = [
  "agent-analytics",
  "web-analytics",
] as const;

/**
 * The analytics tabs under `/geo/traffic`, by the URL segment after it: none
 * for Agent, then `web` and `mcp`.
 */
export const GEO_TRAFFIC_TABS = ["agents", "web", "mcp"] as const;
