import type { z } from "zod";

import {
  IMPORT_DEFAULT_RETRY_AFTER_SECONDS,
  IMPORT_MAX_RETRY_AFTER_SECONDS,
  IMPORT_REQUEST_TIMEOUT_MS,
  IMPORT_RETRY_AFTER_FALLBACK_SECONDS,
} from "../constants/analytics-imports";
import {
  ImportAuthError,
  ImportFileError,
  ImportProviderError,
  ImportRateLimitedError,
} from "../schemas/analytics-import-errors";
import type { ImportFetch, ImportPage } from "../types/analytics-imports";

function clampWait(seconds: number, fallback: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return fallback;
  }
  return Math.min(Math.ceil(seconds), IMPORT_MAX_RETRY_AFTER_SECONDS);
}

/** Seconds from a Retry-After header (seconds or HTTP date), clamped to an hour. */
export function retryAfterSeconds(
  header: string | null,
  now = Date.now(),
  fallback = IMPORT_DEFAULT_RETRY_AFTER_SECONDS
): number {
  if (!header) {
    return fallback;
  }
  const seconds = Number(header);
  return clampWait(
    Number.isFinite(seconds) ? seconds : (Date.parse(header) - now) / 1000,
    fallback
  );
}

/**
 * How long a 429 asks us to wait: Retry-After, else X-RateLimit-Reset (UTC
 * epoch seconds, as Vercel sends), else the provider's own window.
 */
export function rateLimitWaitSeconds(
  provider: string,
  headers: Headers,
  now = Date.now()
): number {
  const fallback =
    IMPORT_RETRY_AFTER_FALLBACK_SECONDS[provider] ??
    IMPORT_DEFAULT_RETRY_AFTER_SECONDS;
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    return retryAfterSeconds(retryAfter, now, fallback);
  }
  const reset = Number(headers.get("x-ratelimit-reset") ?? Number.NaN);
  return clampWait(reset - now / 1000, fallback);
}

/**
 * JSON request to an analytics provider. 429 becomes a rate-limit error the
 * job sleeps on, 401/403 a reauth error, anything else a provider error.
 */
export async function importRequest<T>(
  provider: string,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  fetchImpl: ImportFetch = fetch
): Promise<T> {
  const response = await fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(IMPORT_REQUEST_TIMEOUT_MS),
  });
  if (response.status === 429) {
    throw new ImportRateLimitedError({
      provider,
      retryAfterSeconds: rateLimitWaitSeconds(provider, response.headers),
    });
  }
  if (response.status === 401 || response.status === 403) {
    throw new ImportAuthError({ provider, status: response.status });
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new ImportProviderError({
      provider,
      status: response.status,
      detail: detail || response.statusText,
    });
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ImportProviderError({
      provider,
      status: response.status,
      detail: "unexpected response shape",
    });
  }
  return parsed.data;
}

/**
 * Follows a provider listing page by page until its cursor runs out or
 * maxPages is reached. The first page is fetched without a cursor.
 */
export async function collectPages<TCursor, TItem>(
  maxPages: number,
  fetchPage: (
    cursor: TCursor | undefined
  ) => Promise<ImportPage<TCursor, TItem>>
): Promise<TItem[]> {
  const items: TItem[] = [];
  let cursor: TCursor | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each page needs the previous page's cursor
    const result = await fetchPage(cursor);
    items.push(...result.items);
    if (!result.next) {
      break;
    }
    cursor = result.next;
  }
  return items;
}

/** Human-readable reason for logs and the imports list. */
export function describeImportError(error: unknown): string {
  if (error instanceof ImportRateLimitedError) {
    const limit = error.budget
      ? "request budget used up"
      : "rate limit reached";
    return `${error.provider} ${limit}; retrying in ${error.retryAfterSeconds}s`;
  }
  if (error instanceof ImportAuthError) {
    return `${error.provider} rejected the credentials${error.status ? ` (${error.status})` : ""}`;
  }
  if (error instanceof ImportProviderError) {
    return `${error.provider} error${error.status ? ` ${error.status}` : ""}: ${error.detail}`;
  }
  if (error instanceof ImportFileError) {
    return error.file ? `${error.file}: ${error.detail}` : error.detail;
  }
  return error instanceof Error ? error.message : String(error);
}
