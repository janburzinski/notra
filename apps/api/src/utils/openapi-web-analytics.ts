import { OPENAPI_HTTP_METHODS } from "../constants/openapi";
import {
  WEB_ANALYTICS_BETA_NOTE,
  WEB_ANALYTICS_BETA_SUMMARY_SUFFIX,
  WEB_ANALYTICS_ROUTE_PATHS,
} from "../constants/web-analytics";
import type { OpenApiDocumentPaths } from "../types/openapi";

/** `/v1/projects/{projectId}/x` in the document is `/v1/projects/:projectId/x` in Hono. */
function honoPath(openApiPath: string): string {
  return openApiPath.replaceAll(/\{([^}]+)\}/g, ":$1");
}

export function isWebAnalyticsPath(openApiPath: string): boolean {
  const path = honoPath(openApiPath);
  return WEB_ANALYTICS_ROUTE_PATHS.some((pattern) =>
    pattern.endsWith("/*")
      ? path.startsWith(pattern.slice(0, -1))
      : path === pattern
  );
}

/**
 * Labels the operations behind the web analytics flag as private beta. It reads
 * the same path list as the middleware that answers 403, so the label and the
 * gate cannot drift apart.
 */
export function markWebAnalyticsBeta<T extends OpenApiDocumentPaths>(
  document: T
): T {
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (!(item && isWebAnalyticsPath(path))) {
      continue;
    }
    for (const method of OPENAPI_HTTP_METHODS) {
      const operation = item[method];
      if (!operation) {
        continue;
      }
      if (operation.summary) {
        operation.summary += WEB_ANALYTICS_BETA_SUMMARY_SUFFIX;
      }
      operation.description = operation.description
        ? `${WEB_ANALYTICS_BETA_NOTE} ${operation.description}`
        : WEB_ANALYTICS_BETA_NOTE;
    }
  }
  return document;
}
