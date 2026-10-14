import {
  MAX_CATALOG_ITEMS,
  MAX_CATALOG_PAGE_ITEMS,
  MAX_CATALOG_PAGES,
  REQUEST_TIMEOUT_MS,
  VERCEL_API,
} from "../constants/metrics.ts";
import { catalogPage } from "../schemas/metrics.ts";
import type {
  CatalogMetric,
  VercelApi,
  VercelRequest,
} from "../types/metrics.ts";
import { readJson } from "./read-json.ts";

export function vercelApi(
  teamId: string | undefined,
  token: string | undefined,
  request: VercelRequest = fetch
): VercelApi {
  if (
    !teamId ||
    !/^team_[a-zA-Z0-9]+$/.test(teamId) ||
    !token ||
    /[\r\n]/.test(token)
  ) {
    throw new Error("Invalid Vercel monitoring credentials");
  }
  return async (path, body) => {
    if (path !== "/metrics/v1" && !path.startsWith("/metrics/v1?")) {
      throw new Error("Unsupported monitoring API");
    }
    const url = new URL(path, VERCEL_API);
    url.searchParams.set("teamId", teamId);
    let response: Response;
    try {
      response = await request(url, {
        method: body ? "POST" : "GET",
        redirect: "error",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Error("request_failed");
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new Error(`http_${response.status}`);
    }
    return readJson(response);
  };
}

export async function metricCatalog(api: VercelApi): Promise<CatalogMetric[]> {
  const metrics: CatalogMetric[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_CATALOG_PAGES; page++) {
    const params = new URLSearchParams({
      kind: "system",
      limit: String(MAX_CATALOG_PAGE_ITEMS),
    });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const response = catalogPage(await api(`/metrics/v1?${params}`));
    if (metrics.length + response.metrics.length > MAX_CATALOG_ITEMS) {
      throw new Error("catalog_limit");
    }
    metrics.push(...response.metrics);
    if (!response.pagination?.hasMore) {
      if (
        !metrics.length ||
        new Set(metrics.map(({ id }) => id)).size !== metrics.length
      ) {
        throw new Error("invalid_catalog");
      }
      return metrics;
    }
    if (
      typeof response.pagination.nextCursor !== "string" ||
      !response.pagination.nextCursor ||
      cursor === response.pagination.nextCursor
    ) {
      throw new Error("invalid_cursor");
    }
    cursor = response.pagination.nextCursor;
  }
  throw new Error("catalog_page_limit");
}
