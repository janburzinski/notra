import { GEO_NON_AI_BOT_PATTERNS } from "../constants/geo";
import {
  WEB_AUTOMATION_UA_PATTERNS,
  WEB_HASH_ROUTE_MAX_LENGTH,
  WEB_HASH_ROUTE_PATTERN,
  WEB_MACHINE_PATH_PATTERN,
} from "../constants/web-analytics";
import type { WebPageViewInput } from "../types/ingest";
import { scrubWebPath } from "./web-path-scrub";

/**
 * The stored page path. Only a `data-hash` install keeps its hash route, and
 * only a path-like one; every other fragment is dropped. Segments that look
 * like ids or personal data are replaced.
 */
export function webPagePath(url: URL, hashRoutes = false): string {
  const route = hashRoutes ? WEB_HASH_ROUTE_PATTERN.exec(url.hash)?.[0] : "";
  return scrubWebPath(
    route
      ? `${url.pathname}${route.slice(0, WEB_HASH_ROUTE_MAX_LENGTH)}`
      : url.pathname
  );
}

export function isHumanPageView(
  input: Pick<WebPageViewInput, "classification" | "payload" | "url">
): boolean {
  const { classification, payload, url } = input;
  if (
    classification.visitorType !== "human" &&
    classification.visitorType !== "ai_referral"
  ) {
    return false;
  }
  if (payload.method.toUpperCase() !== "GET" || payload.signals?.prefetch) {
    return false;
  }
  if (
    payload.status !== undefined &&
    payload.status >= 300 &&
    payload.status !== 404
  ) {
    return false;
  }
  const userAgent = payload.userAgent?.toLowerCase() ?? "";
  if (
    GEO_NON_AI_BOT_PATTERNS.some((pattern) => userAgent.includes(pattern)) ||
    WEB_AUTOMATION_UA_PATTERNS.some((pattern) => userAgent.includes(pattern))
  ) {
    return false;
  }
  return !WEB_MACHINE_PATH_PATTERN.test(url.pathname);
}
