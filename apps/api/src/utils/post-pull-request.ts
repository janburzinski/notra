import { createContentPullRequestResultSchema } from "@notra/ai/schemas/content-pull-request";
import { githubIntegrations } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { POST_PULL_REQUEST_TIMEOUT_MS } from "../constants/post-pull-request";
import {
  PostDatabaseError,
  PostGenerationTargetUnavailableError,
} from "../errors/posts";
import type { DbClient } from "../types/db";
import { resolveRequestedRepositoryIds } from "./content-generation";
import {
  callDashboardInternal,
  getInternalWorkflowUrl,
} from "./internal-workflow";

/**
 * The repository a post's pull request opens in: the requested one, or the
 * organization's only connected repository when none is named.
 */
export const resolvePullRequestIntegrationId = Effect.fn(
  "posts.resolvePullRequestIntegrationId"
)(function* (
  db: DbClient,
  organizationId: string,
  request: {
    integrationId?: string;
    github?: { owner: string; repo: string };
  }
) {
  if (request.integrationId || request.github) {
    const ids = yield* resolveRequestedRepositoryIds(db, organizationId, {
      integrations: request.integrationId
        ? { github: [request.integrationId] }
        : undefined,
      github: request.github ? { repositories: [request.github] } : undefined,
    });
    const [id] = ids ?? [];
    if (!id) {
      return yield* new PostGenerationTargetUnavailableError({
        message: "The requested GitHub repository is not connected",
      });
    }
    return id;
  }

  const connected = yield* Effect.tryPromise({
    try: () =>
      db
        .select({ id: githubIntegrations.id })
        .from(githubIntegrations)
        .where(
          and(
            eq(githubIntegrations.organizationId, organizationId),
            eq(githubIntegrations.enabled, true)
          )
        ),
    catch: (cause) => new PostDatabaseError({ cause }),
  });
  const [only] = connected;
  if (connected.length === 1 && only) {
    return only.id;
  }
  return yield* new PostGenerationTargetUnavailableError({
    message:
      connected.length === 0
        ? "No GitHub repository is connected to this organization"
        : "Several GitHub repositories are connected; pass integrationId or github to pick one",
  });
});

export async function openPostPullRequest(
  env: { WORKFLOW_BASE_URL?: string },
  params: { organizationId: string; postId: string; integrationId: string }
) {
  const url = getInternalWorkflowUrl(
    env,
    "/api/internal/content/draft-pull-request"
  );
  if (!url) {
    throw new Error("WORKFLOW_BASE_URL is not configured");
  }
  return await callDashboardInternal(
    url,
    params,
    createContentPullRequestResultSchema,
    POST_PULL_REQUEST_TIMEOUT_MS
  );
}
