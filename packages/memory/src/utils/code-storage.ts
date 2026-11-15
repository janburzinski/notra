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
 * Deletes a repository, treating one that is already gone as deleted. The
 * SDK takes no signal, so the deadline is enforced around it; one signal can
 * cover many deletions, so each removes its own listener.
 */
export async function deleteRepoBefore(
  deletion: Promise<unknown>,
  signal?: AbortSignal
) {
  const deleted = deletion.then(
    () => undefined,
    (error: unknown) => {
      if (!isRepoNotFound(error)) {
        throw error;
      }
    }
  );
  if (!signal) {
    return deleted;
  }
  let onAbort: (() => void) | undefined;
  try {
    await Promise.race([
      deleted,
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
