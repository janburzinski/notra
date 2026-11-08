import { createRoute } from "@hono/zod-openapi";
import { requestGeoRescanForPost } from "@notra/geo-core/geo/rescan";
import {
  createPostGenerationRequestSchema,
  createPostGenerationResponseSchema,
  createPostPullRequestRequestSchema,
  createPostPullRequestResponseSchema,
  createPostRequestSchema,
  createPostResponseSchema,
  deletePostResponseSchema,
  generationQueueErrorResponseSchema,
  getPostGenerationParamsSchema,
  getPostGenerationResponseSchema,
  getPostParamsSchema,
  getPostResponseSchema,
  getPostsOpenApiQuerySchema,
  getPostsParamsSchema,
  getPostsResponseSchema,
  listPostAuthorsResponseSchema,
  patchPostRequestSchema,
  patchPostResponseSchema,
} from "@notra/schemas/api/content";
import {
  InternalDashboardError,
  InternalDashboardTimeoutError,
} from "@notra/schemas/api/internal-dashboard";
import { rateLimitResponseSchema } from "@notra/schemas/api/responses";
import { Effect } from "effect";

import { ORGANIZATION_SCOPED_API_KEY_ERROR } from "../constants/skills";
import {
  createPost,
  createPostGeneration,
  commitPatchPost,
  deletePost,
  getPost,
  getPostGeneration,
  listPostAuthors,
  listPosts,
  preparePatchPost,
} from "../programs/posts";
import { runGeoEffect } from "../runtime/geo";
import { isOAuthAuth } from "../types/auth";
import { getOrganizationId } from "../utils/auth";
import {
  applyPullRequestSelection,
  getContentGenerationUnavailableReason,
  resolveRequestedBrandVoiceId,
  assertContentGenerationSourcesAvailable,
  resolveRequestedLinearIntegrationIds,
  resolveRequestedRepositoryIds,
} from "../utils/content-generation";
import { createOpenApiApp } from "../utils/openapi-app";
import { errorResponse, rateLimitResponse } from "../utils/openapi-responses";
import {
  getOrganizationResponse,
  resolveRequestOrganization,
} from "../utils/organizations";
import {
  openPostPullRequest,
  resolvePullRequestIntegrationId,
} from "../utils/post-pull-request";
import {
  loadPostSiteAuthors,
  verifyPostSiteAuthors,
} from "../utils/post-site-authors";
import {
  postPatchLogFields,
  respondToPostFailure,
  runPostProgram,
  serializePost,
} from "../utils/posts";
import {
  enforceRatelimit,
  RATE_LIMITS,
  ratelimit,
  setRatelimitHeaders,
} from "../utils/ratelimit";
import { getRedis } from "../utils/redis";
import { syncPostGitHub } from "../utils/sync-post-github";

export const postsRoutes = createOpenApiApp();

const getPostsRoute = createRoute({
  method: "get",
  path: "/posts",
  tags: ["Content"],
  operationId: "listPosts",
  summary: "List posts",
  description:
    "Returns posts for the organization the API key belongs to, newest first by default. Only published posts are included unless you pass status=draft,published. Blog posts and changelogs include a metadata object with cover image, tags, excerpt, authors, featured, noindex, hidden and displayDate; it is null for other content types.",
  request: {
    params: getPostsParamsSchema,
    query: getPostsOpenApiQuerySchema,
  },
  responses: {
    200: {
      description: "Posts fetched successfully",
      content: {
        "application/json": {
          schema: getPostsResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid path params or query"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const getPostRoute = createRoute({
  method: "get",
  path: "/posts/{postId}",
  tags: ["Content"],
  operationId: "getPost",
  summary: "Get a single post",
  description:
    "Returns the post. When no post with this ID exists in your organization, the response is still 200 with post set to null. Blog posts and changelogs include a metadata object with cover image, tags, excerpt, authors, featured, noindex, hidden and displayDate; it is null for other content types.",
  request: {
    params: getPostParamsSchema,
  },
  responses: {
    200: {
      description: "Post fetched successfully",
      content: {
        "application/json": {
          schema: getPostResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid path params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const listPostAuthorsRoute = createRoute({
  method: "get",
  path: "/posts/authors",
  tags: ["Content"],
  operationId: "listPostAuthors",
  summary: "List post authors",
  description:
    "Returns the organization's authors, sorted by name. Authors are created in the dashboard; pass their IDs in metadata.authorIds when updating a blog post or changelog. Blog posts on a Notra Sites site can also use that site's own authors from GET /v1/sites/{siteId}/authors.",
  responses: {
    200: {
      description: "Authors fetched successfully",
      content: {
        "application/json": {
          schema: listPostAuthorsResponseSchema,
        },
      },
    },
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const deletePostRoute = createRoute({
  method: "delete",
  path: "/posts/{postId}",
  tags: ["Content"],
  operationId: "deletePost",
  summary: "Delete a single post",
  request: {
    params: getPostParamsSchema,
  },
  responses: {
    200: {
      description: "Post deleted successfully",
      content: {
        "application/json": {
          schema: deletePostResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid path params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Post not found"),
    503: errorResponse("Authentication service unavailable"),
  },
});

const patchPostRoute = createRoute({
  method: "patch",
  path: "/posts/{postId}",
  tags: ["Content"],
  operationId: "updatePost",
  summary: "Update a single post",
  description:
    "Updates any combination of title, slug, markdown, status, and metadata. Sending markdown re-renders the stored HTML, and when title is omitted it is taken from the first heading in the markdown, keeping the existing title when the markdown has no heading. Slugs and metadata are only accepted for blog posts and changelogs. Inside metadata, send only the fields you want to change; tags and authorIds replace the stored list, and authorIds must come from GET /v1/posts/authors. A blog post that publishes to a Notra Sites site can also credit that site's authors as site:<id>, the ref from GET /v1/sites/{siteId}/authors. Title, slug, markdown, or metadata updates also sync a post linked to GitHub: an open pull request gets a new commit, and a repository set to publish directly gets a direct commit when its live branch allows one (unprotected, file unchanged on GitHub). Otherwise, including closed or merged pull requests, GitHub is left as is and no new pull request is opened; the post is still saved. GitHub sync errors occur after saving the post: 429 includes Retry-After, 502 indicates a sync error, and 504 indicates an unknown sync outcome. Check the PR before retrying an unconfirmed sync.",
  request: {
    params: getPostParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: patchPostRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Post updated successfully",
      content: {
        "application/json": {
          schema: patchPostResponseSchema,
        },
      },
    },
    400: errorResponse(
      "Invalid path params or request body, slug or metadata sent for an unsupported content type, or an unknown author ID"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Post not found"),
    409: errorResponse("Post slug already exists or concurrent modification"),
    502: errorResponse(
      "Post saved, but linked GitHub pull request sync failed"
    ),
    504: errorResponse(
      "Post saved; GitHub sync timed out with an unknown outcome"
    ),
    429: {
      ...rateLimitResponse(
        RATE_LIMITS.postUpdate.requests,
        RATE_LIMITS.postUpdate.window,
        "API key"
      ),
      description:
        "Post update or GitHub publish rate limit exceeded. The error states whether the post was already saved; Retry-After specifies when to retry.",
    },
    503: errorResponse("Authentication service unavailable"),
  },
});

const createPostRoute = createRoute({
  method: "post",
  path: "/posts",
  tags: ["Content"],
  operationId: "createPost",
  summary: "Create a post",
  description:
    "Creates a post directly without generation. Omit markdown to create an empty draft you fill in later through the dashboard or PATCH /v1/posts/{postId}. Slugs are only accepted for blog posts and changelogs.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createPostRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: "Post created successfully",
      content: {
        "application/json": {
          schema: createPostResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid request body"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    409: errorResponse("Post slug already exists"),
    429: rateLimitResponse(
      RATE_LIMITS.postUpdate.requests,
      RATE_LIMITS.postUpdate.window,
      "API key"
    ),
    503: errorResponse("Authentication service unavailable"),
  },
});

const createPostGenerationRoute = createRoute({
  method: "post",
  path: "/posts/generate",
  tags: ["Content"],
  operationId: "createPostGeneration",
  summary: "Queue async post generation",
  description:
    "Queues a generation job for one content type and returns 202 with the job. Select sources with integrations.github, integrations.linear, or github.repositories; when no selector is given at all, every connected GitHub integration is used. Pass pullRequest to write about one pull request, and brief to say what the post should cover. Requests with every dataPoints flag false, or with no usable source, are rejected with 400 and code NO_ACTIVITY_TYPES_SELECTED or NO_AVAILABLE_SOURCES before a job is created. Poll GET /v1/posts/generate/{jobId} until job.status is completed, failed, or skipped. Subscribe to post.generation.completed, post.generation.failed, or post.generation.skipped using /v1/webhooks for completion notifications.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createPostGenerationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    202: {
      description: "Post generation queued successfully",
      content: {
        "application/json": {
          schema: createPostGenerationResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid request body"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Organization not found"),
    429: rateLimitResponse(
      RATE_LIMITS.postGeneration.requests,
      RATE_LIMITS.postGeneration.window,
      "API key"
    ),
    503: {
      description: "Content generation is unavailable",
      content: {
        "application/json": {
          schema: generationQueueErrorResponseSchema,
        },
      },
    },
  },
});

const createPostPullRequestRoute = createRoute({
  method: "post",
  path: "/posts/{postId}/pull-request",
  tags: ["Content"],
  operationId: "createPostPullRequest",
  summary: "Open a draft pull request for a post",
  description:
    "Exports a saved blog post or changelog to a draft GitHub pull request, using the repository's configured content path, site metadata and image handling, the same as the dashboard. Always opens a pull request, even for repositories set to publish directly, and never merges it. Calling it again for the same post and repository updates its open pull request instead of opening another.",
  request: {
    params: getPostParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: createPostPullRequestRequestSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Draft pull request opened or updated",
      content: {
        "application/json": {
          schema: createPostPullRequestResponseSchema,
        },
      },
    },
    400: errorResponse(
      "Invalid request, no matching repository, or the post is not a blog post or changelog"
    ),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Post or organization not found"),
    429: rateLimitResponse(
      RATE_LIMITS.postUpdate.requests,
      RATE_LIMITS.postUpdate.window,
      "API key"
    ),
    502: errorResponse("GitHub could not prepare the pull request"),
    503: errorResponse(
      "Pull request export is unavailable or GitHub publishing is rate limited"
    ),
    504: errorResponse("The export timed out and may still complete"),
  },
});

const getPostGenerationRoute = createRoute({
  method: "get",
  path: "/posts/generate/{jobId}",
  tags: ["Content"],
  operationId: "getPostGeneration",
  summary: "Get async post generation status",
  description:
    "Returns the job and its event log. job.status moves from queued to running and ends as completed, failed, or skipped. job.postId is set once the post has been created; fetch it with GET /v1/posts/{postId}.",
  request: {
    params: getPostGenerationParamsSchema,
  },
  responses: {
    200: {
      description: "Post generation status fetched successfully",
      content: {
        "application/json": {
          schema: getPostGenerationResponseSchema,
        },
      },
    },
    400: errorResponse("Invalid path params"),
    401: errorResponse("Missing or invalid API key"),
    403: errorResponse("Forbidden"),
    404: errorResponse("Generation job not found"),
    503: errorResponse("Content generation is unavailable"),
  },
});

postsRoutes.openapi(getPostsRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const result = await runPostProgram(
    listPosts({
      db: c.get("db"),
      organizationId: orgId,
      query: c.req.valid("query"),
    })
  );

  if (result._tag === "Failure") {
    throw result.failure;
  }

  const { authors } = result.success;
  const siteAuthors = await loadPostSiteAuthors(c, orgId, result.success.posts);

  return c.json(
    {
      posts: result.success.posts.map((post) =>
        serializePost(post, authors, siteAuthors)
      ),
      pagination: result.success.pagination,
      organization,
    },
    200
  );
});

postsRoutes.openapi(listPostAuthorsRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const result = await runPostProgram(
    listPostAuthors({ db: c.get("db"), organizationId: orgId })
  );

  if (result._tag === "Failure") {
    throw result.failure;
  }

  return c.json({ authors: result.success.authors, organization }, 200);
});

postsRoutes.openapi(getPostRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const result = await runPostProgram(
    getPost({
      db: c.get("db"),
      organizationId: orgId,
      postId: c.req.valid("param").postId,
    })
  );

  if (result._tag === "Failure") {
    throw result.failure;
  }

  const { post } = result.success;
  const siteAuthors = await loadPostSiteAuthors(c, orgId, post ? [post] : []);

  return c.json(
    {
      post: post
        ? serializePost(post, result.success.authors, siteAuthors)
        : null,
      organization,
    },
    200
  );
});

postsRoutes.openapi(deletePostRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const result = await runPostProgram(
    deletePost({
      db: c.get("db"),
      organizationId: orgId,
      postId: c.req.valid("param").postId,
    })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "PostNotFoundError") {
      return c.json({ error: "Post not found" }, 404);
    }
    throw result.failure;
  }

  return c.json({ id: result.success.id, organization }, 200);
});

postsRoutes.openapi(patchPostRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const { postId } = c.req.valid("param");
  const body = c.req.valid("json");

  const preparedResult = await runPostProgram(
    preparePatchPost({
      db: c.get("db"),
      organizationId: orgId,
      postId,
      body,
    })
  );

  if (preparedResult._tag === "Failure") {
    return respondToPostFailure(c, preparedResult.failure);
  }

  const { siteAuthorIds } = preparedResult.success.prepared;
  if (siteAuthorIds.length > 0) {
    const rejected = await verifyPostSiteAuthors(
      c,
      orgId,
      postId,
      siteAuthorIds
    );
    if (rejected) {
      return rejected;
    }
  }

  const rateLimited = await enforceRatelimit(c, ratelimit.postUpdate);
  if (rateLimited) {
    return rateLimited;
  }

  const result = await runPostProgram(
    commitPatchPost({
      db: c.get("db"),
      organizationId: orgId,
      postId,
      prepared: preparedResult.success.prepared,
    })
  );

  if (result._tag === "Failure") {
    return respondToPostFailure(c, result.failure);
  }

  const { post, authors, previousStatus } = result.success;
  c.get("log").set(postPatchLogFields(body, post));

  if (post.status === "published" && previousStatus !== "published") {
    void runGeoEffect(
      "rescanForPost",
      requestGeoRescanForPost({ organizationId: orgId, postId: post.id })
    );
  }

  if (
    post.githubPublish &&
    (post.contentType === "blog_post" || post.contentType === "changelog") &&
    (body.title !== undefined ||
      body.slug !== undefined ||
      body.markdown !== undefined ||
      body.metadata !== undefined)
  ) {
    try {
      const auth = c.get("auth");
      await syncPostGitHub(
        c.env ?? {},
        orgId,
        post.id,
        isOAuthAuth(auth) ? auth.userId : `api-key:${auth.keyId}`
      );
    } catch (error) {
      c.get("log").error(error instanceof Error ? error : String(error), {
        errorCode: "post_github_sync_failed",
        postId: post.id,
      });
      if (
        error instanceof InternalDashboardTimeoutError ||
        (error instanceof InternalDashboardError && error.status === 504)
      ) {
        return c.json(
          {
            error:
              "Post saved in Notra. GitHub sync timed out and may still complete. The sync outcome is unknown; check the linked pull request before retrying the content update.",
          },
          504
        );
      }
      if (error instanceof InternalDashboardError && error.status === 429) {
        const rateLimit = rateLimitResponseSchema.safeParse(
          await new Response(error.body).json().catch(() => null)
        );
        if (rateLimit.success) {
          const retryAfter = setRatelimitHeaders(c, rateLimit.data);
          c.header("Retry-After", String(retryAfter));
          return c.json(
            {
              ...rateLimit.data,
              error: `Post saved in Notra, but GitHub sync was rate-limited. Retry the content update in ${retryAfter} seconds to sync the linked pull request.`,
            },
            429
          );
        }
      }
      return c.json(
        {
          error:
            "Post saved in Notra, but the linked GitHub pull request update could not be confirmed. Check the pull request before retrying the content update.",
        },
        502
      );
    }
  }

  const siteAuthors = await loadPostSiteAuthors(c, orgId, [post]);
  return c.json(
    { post: serializePost(post, authors, siteAuthors), organization },
    200
  );
});

postsRoutes.openapi(createPostRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;

  const body = c.req.valid("json");

  const rateLimited = await enforceRatelimit(c, ratelimit.postUpdate);
  if (rateLimited) {
    return rateLimited;
  }

  const result = await runPostProgram(
    createPost({
      db: c.get("db"),
      organizationId: orgId,
      body,
    })
  );

  if (result._tag === "Failure") {
    return respondToPostFailure(c, result.failure);
  }

  const { post } = result.success;

  if (post.status === "published") {
    void runGeoEffect(
      "rescanForPost",
      requestGeoRescanForPost({ organizationId: orgId, postId: post.id })
    );
  }

  return c.json({ post: serializePost(post), organization }, 201);
});

postsRoutes.openapi(createPostGenerationRoute, async (c) => {
  const orgId = getOrganizationId(c);
  if (!orgId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }

  const runtimeEnv = c.env ?? {};
  const redis = getRedis(runtimeEnv);
  const unavailableReason = getContentGenerationUnavailableReason(runtimeEnv);
  if (!redis || unavailableReason) {
    return c.json(
      { error: unavailableReason ?? "Content generation is unavailable" },
      503
    );
  }

  const body = c.req.valid("json");
  const organization = await getOrganizationResponse(c.get("db"), orgId);

  if (!organization) {
    return c.json({ error: "Organization not found" }, 404);
  }

  const requestedIntegrations = {
    github: body.integrations?.github ?? body.repositoryIds,
    linear: body.integrations?.linear ?? body.linearIntegrationIds,
  };

  const targets = await runPostProgram(
    Effect.all({
      repositoryIds: resolveRequestedRepositoryIds(c.get("db"), orgId, {
        integrations: requestedIntegrations,
        github: body.pullRequest
          ? {
              repositories: [
                { owner: body.pullRequest.owner, repo: body.pullRequest.repo },
              ],
            }
          : body.github,
      }),
      linearIntegrationIds: resolveRequestedLinearIntegrationIds(
        c.get("db"),
        orgId,
        { integrations: requestedIntegrations }
      ),
      resolvedBrandVoiceId: resolveRequestedBrandVoiceId(
        c.get("db"),
        orgId,
        body.brandIdentityId ?? body.brandVoiceId
      ),
    })
  );

  if (targets._tag === "Failure") {
    return c.json({ error: targets.failure.message }, 400);
  }

  const { repositoryIds, linearIntegrationIds, resolvedBrandVoiceId } =
    targets.success;
  const generationBody = applyPullRequestSelection(body, repositoryIds);

  const sources = await runPostProgram(
    assertContentGenerationSourcesAvailable(c.get("db"), orgId, {
      dataPoints: generationBody.dataPoints,
      repositoryIds,
      linearIntegrationIds,
    })
  );

  if (sources._tag === "Failure") {
    return c.json(
      { error: sources.failure.message, code: sources.failure.code },
      400
    );
  }

  const rateLimited = await enforceRatelimit(c, ratelimit.postGeneration);
  if (rateLimited) {
    return rateLimited;
  }

  const result = await runPostProgram(
    createPostGeneration({
      db: c.get("db"),
      organizationId: orgId,
      body: generationBody,
      redis,
      runtimeEnv,
      repositoryIds,
      linearIntegrationIds,
      resolvedBrandVoiceId,
    })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "PostGenerationQueueFailedError") {
      return c.json(
        {
          error: "Failed to queue content generation",
          ...(result.failure.jobId ? { jobId: result.failure.jobId } : {}),
        },
        503
      );
    }
    throw result.failure;
  }

  return c.json({ job: result.success.job, organization }, 202);
});

postsRoutes.openapi(createPostPullRequestRoute, async (c) => {
  const scope = await resolveRequestOrganization(c);
  if (scope.response) {
    return scope.response;
  }
  const { orgId, organization } = scope;
  const { postId } = c.req.valid("param");
  const body = c.req.valid("json") ?? {};

  if (!c.env?.WORKFLOW_BASE_URL) {
    return c.json({ error: "Pull request export is unavailable" }, 503);
  }

  const rateLimited = await enforceRatelimit(c, ratelimit.postUpdate);
  if (rateLimited) {
    return rateLimited;
  }

  const target = await runPostProgram(
    resolvePullRequestIntegrationId(c.get("db"), orgId, body)
  );
  if (target._tag === "Failure") {
    if (target.failure._tag === "PostGenerationTargetUnavailableError") {
      return c.json({ error: target.failure.message }, 400);
    }
    throw target.failure;
  }

  try {
    const result = await openPostPullRequest(c.env, {
      organizationId: orgId,
      postId,
      integrationId: target.success,
    });
    return c.json(
      {
        organization,
        pullRequest: {
          number: result.pullRequestNumber,
          url: result.pullRequestUrl,
          branchName: result.branchName,
          path: result.path,
          operation: result.operation,
        },
      },
      200
    );
  } catch (error) {
    if (
      error instanceof InternalDashboardTimeoutError ||
      (error instanceof InternalDashboardError && error.status === 504)
    ) {
      return c.json(
        {
          error:
            "Opening the pull request timed out and may still complete. Retry with the same post and repository; it reuses the pull request instead of opening another.",
        },
        504
      );
    }
    if (error instanceof InternalDashboardError && error.status === 429) {
      return c.json(
        {
          error:
            "GitHub publishing is rate limited for this organization. Retry in a minute.",
        },
        503
      );
    }
    if (
      error instanceof InternalDashboardError &&
      (error.status === 400 || error.status === 404)
    ) {
      const message = await new Response(error.body)
        .json()
        .then((value: unknown) =>
          typeof value === "object" &&
          value !== null &&
          "error" in value &&
          typeof value.error === "string"
            ? value.error
            : null
        )
        .catch(() => null);
      return c.json(
        { error: message ?? "GitHub could not prepare the pull request" },
        error.status
      );
    }
    c.get("log").error(error instanceof Error ? error : String(error), {
      errorCode: "post_pull_request_failed",
      postId,
    });
    return c.json(
      {
        error:
          "GitHub could not prepare the pull request. Retry with the same post and repository to recover an existing one.",
      },
      502
    );
  }
});

postsRoutes.openapi(getPostGenerationRoute, async (c) => {
  const orgId = getOrganizationId(c);
  if (!orgId) {
    return c.json({ error: ORGANIZATION_SCOPED_API_KEY_ERROR }, 403);
  }

  const redis = getRedis(c.env ?? {});
  const unavailableReason = getContentGenerationUnavailableReason(c.env ?? {});
  if (!redis || unavailableReason) {
    return c.json(
      { error: unavailableReason ?? "Content generation is unavailable" },
      503
    );
  }

  const result = await runPostProgram(
    getPostGeneration({
      organizationId: orgId,
      jobId: c.req.valid("param").jobId,
      redis,
    })
  );

  if (result._tag === "Failure") {
    if (result.failure._tag === "PostGenerationJobNotFoundError") {
      return c.json({ error: "Generation job not found" }, 404);
    }
    throw result.failure;
  }

  return c.json(
    { job: result.success.job, events: result.success.events },
    200
  );
});
