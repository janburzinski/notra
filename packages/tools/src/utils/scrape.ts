import { isTransientError } from "./retry";

const TARGET_TIMEOUT_STATUS = 408;

/** A 408 from context.dev means the target site timed out, so retrying only waits again. */
export function isRetryableScrapeError(error: unknown): boolean {
  if (
    error instanceof Error &&
    "status" in error &&
    error.status === TARGET_TIMEOUT_STATUS
  ) {
    return false;
  }
  return isTransientError(error);
}
