/** Routes that answer 403 until the workspace has the web analytics flag. */
export const WEB_ANALYTICS_ROUTE_PATHS = [
  "/v1/projects/:projectId/geo/traffic/web",
  "/v1/projects/:projectId/geo/traffic/web/*",
  "/v1/projects/:projectId/geo/traffic/imports",
  "/v1/projects/:projectId/geo/traffic/journey-stats",
] as const;
