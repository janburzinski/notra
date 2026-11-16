import { ApiError } from "@pierre/storage";

import { MEMORY_REPO_NOT_FOUND } from "../constants/memory";

/** The org name and private key, or null when code.storage isn't set up. */
export function codeStorageCredentials() {
  const name = process.env.CODE_STORAGE_NAME?.trim();
  const key = process.env.CODE_STORAGE_API_KEY?.trim().replace(/\\n/g, "\n");
  return name && key ? { name, key } : null;
}

/** The SDK reports a missing repository as a plain Error on some calls. */
export function isRepoNotFound(error: unknown) {
  return (
    (error instanceof ApiError && error.status === 404) ||
    (error instanceof Error && MEMORY_REPO_NOT_FOUND.test(error.message))
  );
}

/**
 * Settles with the request, or rejects with the signal's reason once it
 * aborts. The SDK takes no signal, so the request itself may still land.
 */
export async function beforeAbort<RESULT>(
  request: Promise<RESULT>,
  signal?: AbortSignal
): Promise<RESULT> {
  if (!signal) {
    return request;
  }
  if (signal.aborted) {
    request.catch(() => undefined);
    throw signal.reason;
  }
  // One signal covers many requests, so each removes its own listener.
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
      }),
    ]);
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

/** Deletes a repository, treating one that is already gone as deleted. */
export function deleteRepoBefore(
  deletion: Promise<unknown>,
  signal?: AbortSignal
) {
  return beforeAbort(
    deletion.then(
      () => undefined,
      (error: unknown) => {
        if (!isRepoNotFound(error)) {
          throw error;
        }
      }
    ),
    signal
  );
}
