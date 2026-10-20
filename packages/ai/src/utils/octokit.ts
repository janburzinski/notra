import { isDemoMode } from "@notra/utils/demo-mode";
import { createTimeoutFetch } from "@notra/utils/timeout-fetch";
import { Octokit } from "@octokit/core";

import { demoGitHubFetch } from "./demo-github";

/**
 * Budget for GitHub reads that a user is waiting on (repo probe, repository
 * listings). Publishing, uploads and recursive tree reads stay unbounded: an
 * aborted write can leave a half-applied commit, and large trees legitimately
 * take longer than an interactive request.
 */
export const GITHUB_INTERACTIVE_READ_TIMEOUT_MS = 15_000;

const STALE_SOCKET_ERROR =
  /ECONNRESET|socket connection was closed unexpectedly/i;
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD"]);

/**
 * Bun can hand out a pooled keep-alive socket GitHub already closed. Writes
 * get a fresh connection instead of a retry, since a retried write may apply
 * twice; reads are retried once on a fresh socket.
 */
function guardStaleSockets(base: typeof fetch): typeof fetch {
  const guarded = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (!IDEMPOTENT_METHODS.has(method)) {
      return base(input, { ...init, keepalive: false });
    }
    try {
      return await base(input, init);
    } catch (error) {
      if (
        init?.signal?.aborted ||
        !(error instanceof Error && STALE_SOCKET_ERROR.test(error.message))
      ) {
        throw error;
      }
      return base(input, { ...init, keepalive: false });
    }
  };
  return Object.assign(guarded, fetch);
}

function requestFetch(options?: {
  requestTimeoutMs?: number;
  avoidStaleSockets?: boolean;
}): typeof fetch | undefined {
  if (isDemoMode()) {
    return demoGitHubFetch;
  }
  const base =
    options?.requestTimeoutMs === undefined
      ? undefined
      : createTimeoutFetch(options.requestTimeoutMs);
  if (!options?.avoidStaleSockets) {
    return base;
  }
  return guardStaleSockets(base ?? fetch);
}

export function createOctokit(
  auth?: string,
  options?: { requestTimeoutMs?: number; avoidStaleSockets?: boolean }
) {
  const fetch = requestFetch(options);
  return new Octokit({ auth, ...(fetch ? { request: { fetch } } : {}) });
}
