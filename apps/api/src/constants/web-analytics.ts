/** Routes that answer 403 until the workspace has the web analytics flag. */
export const WEB_ANALYTICS_ROUTE_PATHS = [
  "/v1/projects/:projectId/geo/traffic/web",
  "/v1/projects/:projectId/geo/traffic/web/*",
  "/v1/projects/:projectId/geo/traffic/imports",
  "/v1/projects/:projectId/geo/traffic/journey-stats",
] as const;

/** Added to the summary of every route above in the published OpenAPI document. */
export const WEB_ANALYTICS_BETA_SUMMARY_SUFFIX = " (private beta)";

/** Opens the description of every route above in the published OpenAPI document. */
export const WEB_ANALYTICS_BETA_NOTE =
  "Private beta: workspaces without web analytics access get 403.";
