import { Effect } from "effect";

import { fingerprintGithubToken } from "@/lib/star-video/github-oauth";
import type {
  LoadRepoPrMergeResult,
  PrMergePeriodDays,
} from "@/types/pr-merge-video";

import { fetchRepoPrMergeData } from "./github";

function failureKind(
  tag: string
): "not-found" | "unavailable" | "unauthorized" {
  if (tag === "RepoUnavailable") {
    return "unavailable";
  }
  if (tag === "RepoUnauthorized") {
    return "unauthorized";
  }
  return "not-found";
}

const inflight = new Map<string, Promise<LoadRepoPrMergeResult>>();

export function loadRepoPrMergeData(
  owner: string,
  repo: string,
  days: PrMergePeriodDays,
  token: string
): Promise<LoadRepoPrMergeResult> {
  const inflightKey = `${owner}/${repo}:${days}:${fingerprintGithubToken(token)}`;
  const existing = inflight.get(inflightKey);
  if (existing) {
    return existing;
  }

  const promise = Effect.runPromise(
    fetchRepoPrMergeData(owner, repo, days, token).pipe(
      Effect.match({
        onSuccess: (data): LoadRepoPrMergeResult => ({ ok: true, data }),
        onFailure: (error): LoadRepoPrMergeResult => ({
          ok: false,
          kind: failureKind(error._tag),
        }),
      })
    )
  );

  inflight.set(inflightKey, promise);
  promise.finally(() => {
    inflight.delete(inflightKey);
  });
  return promise;
}
