/**
 * The dashboard reads the repository, uploads images and opens the pull
 * request in one call, so allow it longer than a sync, within
 * SYNCHRONOUS_INTERNAL_CALL_TIMEOUT_MS.
 */
export const POST_PULL_REQUEST_TIMEOUT_MS = 150_000;
