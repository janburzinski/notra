import {
  GITHUB_API_VERSION_HEADERS,
  MERGED_PULL_REQUESTS_MAX_PAGES,
  MERGED_PULL_REQUESTS_PAGE_SIZE,
} from "@notra/ai/constants/github";
import type {
  AgentDataPointSettings,
  ResolveIntegrationContext,
} from "@notra/ai/types/agents";
import type {
  CommitWindow,
  GitHubSelectionFilters,
  GitHubToolRepositoryContext,
  GitHubToolsAccessConfig,
} from "@notra/ai/types/tools";
import { withGitHubRateLimitHandling } from "@notra/ai/utils/github-rate-limit";
import { createOctokit } from "@notra/ai/utils/octokit";
import {
  isInternalPullRequestTitle,
  isMaintenanceBotLogin,
  previewPullRequestBody,
} from "@notra/ai/utils/pull-request-body";
import { type Tool, tool } from "ai";
import * as z from "zod";

import { getAICachedTools } from "./tool-cache";

// Kept for existing `@notra/ai/tools/github` importers.
export { isGitHubRateLimitError } from "@notra/ai/utils/github-rate-limit";

const LINK_HEADER_NEXT_PAGE_REGEX = /<([^>]+)>\s*;\s*rel="next"/i;

function createIntegrationContextResolver(
  config?: GitHubToolsAccessConfig,
  resolveContext?: ResolveIntegrationContext
) {
  const cache = new Map<string, Promise<GitHubToolRepositoryContext>>();

  return async (integrationId: string) => {
    if (
      config?.allowedIntegrationIds !== undefined &&
      !config.allowedIntegrationIds.includes(integrationId)
    ) {
      throw new Error(
        `Repository access denied. Integration ID ${integrationId} is not in the allowed list.`
      );
    }

    let cached = cache.get(integrationId);
    if (!cached) {
      if (!resolveContext) {
        throw new Error(
          "No resolveContext callback provided for GitHub tool integration resolution."
        );
      }
      cached = resolveContext(integrationId, {
        organizationId: config?.organizationId,
      });
      cache.set(integrationId, cached);
      cached.catch(() => {
        cache.delete(integrationId);
      });
    }
    return cached;
  };
}

function createAllowedNumberLookup(
  values: Record<string, number[]> | undefined
) {
  if (!values) {
    return undefined;
  }

  return new Map(
    Object.entries(values).map(([integrationId, numbers]) => [
      integrationId,
      new Set(
        (numbers ?? []).map((value) => Number(value)).filter(Number.isFinite)
      ),
    ])
  );
}

function createAllowedStringLookup(
  values: Record<string, string[]> | undefined
) {
  if (!values) {
    return undefined;
  }

  return new Map(
    Object.entries(values).map(([integrationId, tags]) => [
      integrationId,
      new Set(
        (tags ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .map((value) => value.toLowerCase())
      ),
    ])
  );
}

function getNextPageFromLinkHeader(
  linkHeader?: string | number
): number | undefined {
  if (typeof linkHeader !== "string" || !linkHeader.trim()) {
    return undefined;
  }
  const nextMatch = linkHeader.match(LINK_HEADER_NEXT_PAGE_REGEX);
  if (!nextMatch?.[1]) {
    return undefined;
  }
  try {
    const url = new URL(nextMatch[1]);
    const pageValue = url.searchParams.get("page");
    if (!pageValue) {
      return undefined;
    }
    const parsed = Number.parseInt(pageValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function createGetPullRequestsTool(
  config?: GitHubToolsAccessConfig,
  resolveContext?: ResolveIntegrationContext
): Tool {
  const cached = getAICachedTools({
    organizationId: config?.organizationId,
    namespace: "github",
    scope: config,
  });
  const resolveIntegrationContext = createIntegrationContextResolver(
    config,
    resolveContext
  );
  const allowedPullRequestNumbersByIntegrationId = createAllowedNumberLookup(
    config?.allowedPullRequestNumbersByIntegrationId
  );

  return cached(
    tool({
      description:
        "Get full details of a GitHub pull request (title, body, status, reviewers, diff stats, labels). Requires integrationId and pull_number.",
      inputSchema: z.object({
        integrationId: z
          .string()
          .describe("The integration ID for the configured repository"),
        pull_number: z
          .number()
          .describe("The number of the pull request to get the details for"),
      }),
      execute: async ({ integrationId, pull_number }) => {
        const allowedPullRequestNumbers =
          allowedPullRequestNumbersByIntegrationId?.get(integrationId);
        if (
          allowedPullRequestNumbers &&
          !allowedPullRequestNumbers.has(pull_number)
        ) {
          throw new Error(
            `Pull request #${String(pull_number)} is outside the selected item filter for integration ${integrationId}.`
          );
        }

        const resolved = await resolveIntegrationContext(integrationId);
        const octokit = createOctokit(resolved.token);
        const pullRequest = await withGitHubRateLimitHandling(() =>
          octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
            owner: resolved.owner,
            repo: resolved.repo,
            pull_number,
            headers: GITHUB_API_VERSION_HEADERS,
          })
        );
        return {
          id: pullRequest.data.id,
          number: pullRequest.data.number,
          title: pullRequest.data.title,
          body: pullRequest.data.body ?? null,
          state: pullRequest.data.state,
          isDraft: pullRequest.data.draft,
          merged: pullRequest.data.merged,
          mergeableState: pullRequest.data.mergeable_state,
          authorLogin: pullRequest.data.user?.login ?? "unknown",
          authorAssociation: pullRequest.data.author_association,
          labels: pullRequest.data.labels.map((label) =>
            typeof label === "string" ? label : label.name
          ),
          requestedReviewers: (pullRequest.data.requested_reviewers ?? []).map(
            (reviewer) => reviewer.login
          ),
          head: {
            ref: pullRequest.data.head.ref,
            sha: pullRequest.data.head.sha,
          },
          base: {
            ref: pullRequest.data.base.ref,
            sha: pullRequest.data.base.sha,
          },
          stats: {
            commits: pullRequest.data.commits,
            additions: pullRequest.data.additions,
            deletions: pullRequest.data.deletions,
            changedFiles: pullRequest.data.changed_files,
            comments: pullRequest.data.comments,
            reviewComments: pullRequest.data.review_comments,
          },
          createdAt: pullRequest.data.created_at,
          updatedAt: pullRequest.data.updated_at,
          closedAt: pullRequest.data.closed_at,
          mergedAt: pullRequest.data.merged_at,
          htmlUrl: pullRequest.data.html_url,
          repositoryIsPrivate: pullRequest.data.base.repo.private,
        };
      },
    }),
    {
      ttl: 10 * 60 * 1000,
      keyGenerator: (params: unknown) => {
        const { integrationId, pull_number } = params as {
          integrationId: string;
          pull_number: number;
        };
        return `get_pull_requests:integration=${integrationId}#${String(pull_number)}`;
      },
    }
  );
}

export function createGetReleaseByTagTool(
  config?: GitHubToolsAccessConfig,
  resolveContext?: ResolveIntegrationContext
): Tool {
  const cached = getAICachedTools({
    organizationId: config?.organizationId,
    namespace: "github",
    scope: config,
  });
  const resolveIntegrationContext = createIntegrationContextResolver(
    config,
    resolveContext
  );
  const allowedReleaseTagsByIntegrationId = createAllowedStringLookup(
    config?.allowedReleaseTagsByIntegrationId
  );
  const hasReleaseSelectionFilter =
    config?.allowedReleaseTagsByIntegrationId !== undefined ||
    config?.allowedReleaseTagsGlobal !== undefined;
  const allowedReleaseTagsGlobal =
    config?.allowedReleaseTagsGlobal !== undefined
      ? new Set(
          config.allowedReleaseTagsGlobal
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0)
        )
      : undefined;

  return cached(
    tool({
      description:
        "Get a GitHub release by tag name (release notes, assets, timestamps). Use 'latest' if no version is specified.",
      inputSchema: z.object({
        integrationId: z
          .string()
          .describe("The integration ID for the configured repository"),
        tag: z
          .string()
          .default("latest")
          .describe(
            "The tag of the release to get the details for. Use 'latest' if you don't know the tag"
          ),
      }),
      execute: async ({ integrationId, tag }) => {
        const normalizedTag = tag.trim().toLowerCase();
        const isLatestRequest = normalizedTag === "latest";
        const allowedTagsForIntegration =
          allowedReleaseTagsByIntegrationId?.get(integrationId);

        if (hasReleaseSelectionFilter && !isLatestRequest) {
          const isAllowedForIntegration =
            allowedTagsForIntegration?.has(normalizedTag) ?? false;
          const isAllowedGlobally =
            allowedReleaseTagsGlobal?.has(normalizedTag) ?? false;

          if (!isAllowedForIntegration && !isAllowedGlobally) {
            throw new Error(
              `Release tag "${tag}" is outside the selected item filter for integration ${integrationId}.`
            );
          }
        }

        const resolved = await resolveIntegrationContext(integrationId);
        const octokit = createOctokit(resolved.token);

        const endpoint = isLatestRequest
          ? "GET /repos/{owner}/{repo}/releases/latest"
          : "GET /repos/{owner}/{repo}/releases/tags/{tag}";
        const releases = await withGitHubRateLimitHandling(() =>
          octokit.request(endpoint, {
            owner: resolved.owner,
            repo: resolved.repo,
            ...(isLatestRequest ? {} : { tag }),
            headers: GITHUB_API_VERSION_HEADERS,
          })
        );

        if (isLatestRequest && hasReleaseSelectionFilter) {
          const resolvedTag = releases.data.tag_name.trim().toLowerCase();
          const isAllowedForIntegration =
            allowedTagsForIntegration?.has(resolvedTag) ?? false;
          const isAllowedGlobally =
            allowedReleaseTagsGlobal?.has(resolvedTag) ?? false;

          if (!isAllowedForIntegration && !isAllowedGlobally) {
            throw new Error(
              `Latest release tag "${releases.data.tag_name}" is outside the selected item filter for integration ${integrationId}.`
            );
          }
        }

        return {
          id: releases.data.id,
          tagName: releases.data.tag_name,
          targetCommitish: releases.data.target_commitish,
          name: releases.data.name ?? null,
          body: releases.data.body ?? null,
          draft: releases.data.draft,
          prerelease: releases.data.prerelease,
          immutable: releases.data.immutable,
          authorLogin: releases.data.author?.login ?? "unknown",
          createdAt: releases.data.created_at,
          publishedAt: releases.data.published_at ?? null,
          updatedAt: releases.data.updated_at ?? null,
          htmlUrl: releases.data.html_url,
          discussionUrl: releases.data.discussion_url ?? null,
          mentionsCount: releases.data.mentions_count ?? 0,
          assets: releases.data.assets.map((asset) => ({
            id: asset.id,
            name: asset.name,
            label: asset.label ?? null,
            contentType: asset.content_type,
            state: asset.state,
            size: asset.size,
            downloadCount: asset.download_count,
            browserDownloadUrl: asset.browser_download_url,
          })),
        };
      },
    }),
    {
      ttl: 30 * 60 * 1000,
      keyGenerator: (params: unknown) => {
        const { integrationId, tag } = params as {
          integrationId: string;
          tag?: string;
        };
        return `get_release_by_tag:integration=${integrationId}@${String(tag ?? "latest").toLowerCase()}`;
      },
    }
  );
}

export const getISODateFromDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

/** The enforced window bounds a request; tool arguments may only narrow it. */
function createWindowClamp(enforcedWindow: CommitWindow | undefined) {
  return (since?: string, until?: string) => {
    if (!enforcedWindow) {
      return { since, until };
    }
    return {
      since:
        since && Date.parse(since) > Date.parse(enforcedWindow.since)
          ? since
          : enforcedWindow.since,
      until:
        until && Date.parse(until) < Date.parse(enforcedWindow.until)
          ? until
          : enforcedWindow.until,
    };
  };
}

export function createListMergedPullRequestsTool(
  config?: GitHubToolsAccessConfig,
  resolveContext?: ResolveIntegrationContext
): Tool {
  const cached = getAICachedTools({
    organizationId: config?.organizationId,
    namespace: "github",
    scope: config,
  });
  const resolveIntegrationContext = createIntegrationContextResolver(
    config,
    resolveContext
  );
  const allowedPullRequestNumbersByIntegrationId = createAllowedNumberLookup(
    config?.allowedPullRequestNumbersByIntegrationId
  );
  const clampToWindow = createWindowClamp(config?.enforcedCommitWindow);

  return cached(
    tool({
      description:
        "List every pull request merged into the repository's default branch within a timeframe in one call, newest first, with title, the start of the description and labels. Pull requests from dependency and CI bots (Dependabot, Renovate and similar) and ones titled as internal work (chore, ci, test, refactor and similar) are listed only by number and title under skipped. Also says whether the repository is private. Call it once per repository, then call getPullRequests only for the few pull requests you give their own section.",
      inputSchema: z.object({
        integrationId: z
          .string()
          .describe("The integration ID for the configured repository"),
        since: z
          .string()
          .datetime()
          .optional()
          .describe("UTC ISO timestamp for the start of the range"),
        until: z
          .string()
          .datetime()
          .optional()
          .describe("UTC ISO timestamp for the end of the range"),
        startPage: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe(
            "Only when an earlier call for the same range returned nextPage: pass it here to read the rest"
          ),
      }),
      execute: async ({ integrationId, since, until, startPage = 1 }) => {
        const resolved = await resolveIntegrationContext(integrationId);
        const window = clampToWindow(since, until);
        const sinceMs = Date.parse(window.since ?? getISODateFromDaysAgo(7));
        const untilMs = Date.parse(window.until ?? new Date().toISOString());
        const allowedNumbers =
          allowedPullRequestNumbersByIntegrationId?.get(integrationId);
        const octokit = createOctokit(resolved.token);

        let isPrivate: boolean | null = null;
        let base = resolved.defaultBranch;
        // Without a base, GitHub lists PRs merged into any branch, including
        // ones that have not shipped yet.
        if (!base) {
          const { data: repository } = await withGitHubRateLimitHandling(() =>
            octokit.request("GET /repos/{owner}/{repo}", {
              owner: resolved.owner,
              repo: resolved.repo,
              headers: GITHUB_API_VERSION_HEADERS,
            })
          );
          base = repository.default_branch;
          isPrivate = repository.private;
        }

        const fetchClosedPullRequestsPage = (page: number) =>
          withGitHubRateLimitHandling(() =>
            octokit.request("GET /repos/{owner}/{repo}/pulls", {
              owner: resolved.owner,
              repo: resolved.repo,
              state: "closed",
              sort: "updated",
              direction: "desc",
              page,
              per_page: MERGED_PULL_REQUESTS_PAGE_SIZE,
              base,
              headers: GITHUB_API_VERSION_HEADERS,
            })
          );

        type ClosedPullRequest = Awaited<
          ReturnType<typeof fetchClosedPullRequestsPage>
        >["data"][number];
        const merged: ClosedPullRequest[] = [];
        // A request outside the enforced window clamps to an empty range.
        let done = sinceMs > untilMs;
        let page = startPage;
        const lastPage = startPage + MERGED_PULL_REQUESTS_MAX_PAGES - 1;
        for (; !done && page <= lastPage; page += 1) {
          // react-doctor-disable-next-line react-doctor/async-await-in-loop -- each page decides whether the next one can still hold a merge in the window
          const response = await fetchClosedPullRequestsPage(page);
          isPrivate ??= response.data[0]?.base.repo.private ?? null;
          for (const pullRequest of response.data) {
            const mergedMs = pullRequest.merged_at
              ? Date.parse(pullRequest.merged_at)
              : Number.NaN;
            if (
              mergedMs >= sinceMs &&
              mergedMs <= untilMs &&
              (!allowedNumbers || allowedNumbers.has(pullRequest.number))
            ) {
              merged.push(pullRequest);
            }
          }
          // Sorted by last update, so once a page reaches pull requests last
          // touched before the window, no later page can hold one merged in it.
          const oldest = response.data.at(-1);
          done =
            !oldest ||
            Date.parse(oldest.updated_at) < sinceMs ||
            getNextPageFromLinkHeader(response.headers?.link) === undefined;
        }
        const truncated = !done;

        // Dependency and CI bot pull requests and ones titled as internal work never reach the
        // entry, so only their number and title are listed.
        const pullRequests = merged
          .filter(
            (pullRequest) =>
              !isMaintenanceBotLogin(pullRequest.user?.login) &&
              !isInternalPullRequestTitle(pullRequest.title)
          )
          .map((pullRequest) => {
            const labels = pullRequest.labels.map((label) => label.name);
            return {
              number: pullRequest.number,
              title: pullRequest.title,
              ...previewPullRequestBody(pullRequest.body),
              ...(labels.length > 0 ? { labels } : {}),
            };
          });
        const listedNumbers = new Set(
          pullRequests.map((pullRequest) => pullRequest.number)
        );
        const skipped = merged
          .filter((pullRequest) => !listedNumbers.has(pullRequest.number))
          .map(
            (pullRequest) =>
              `#${String(pullRequest.number)} ${pullRequest.title}`
          );

        return {
          repository: {
            fullName: `${resolved.owner}/${resolved.repo}`,
            isPrivate,
          },
          pullRequests,
          skipped,
          ...(truncated
            ? {
                nextPage: page,
                truncated: `More pull requests were updated since this window started than one call reads. Call listMergedPullRequests again with the same range and startPage: ${String(page)} for the rest.`,
              }
            : {}),
        };
      },
    }),
    {
      ttl: 2 * 60 * 1000,
      keyGenerator: (params: unknown) => {
        const { integrationId, since, until, startPage } = params as {
          integrationId: string;
          since?: string;
          until?: string;
          startPage?: number;
        };
        const window = clampToWindow(since, until);
        return `list_merged_pull_requests:integration=${integrationId}:since=${window.since ?? "auto"}:until=${window.until ?? "auto"}:page=${String(startPage ?? 1)}`;
      },
    }
  );
}

export function createGetCommitsByTimeframeTool(
  config?: GitHubToolsAccessConfig,
  resolveContext?: ResolveIntegrationContext
): Tool {
  const cached = getAICachedTools({
    organizationId: config?.organizationId,
    namespace: "github",
    scope: config,
  });
  const resolveIntegrationContext = createIntegrationContextResolver(
    config,
    resolveContext
  );
  const allowedCommitShas =
    config?.allowedCommitShas !== undefined
      ? new Set(
          config.allowedCommitShas
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0)
        )
      : undefined;
  const clampToCommitWindow = createWindowClamp(config?.enforcedCommitWindow);

  return cached(
    tool({
      description:
        "Get paginated GitHub commits within a timeframe. Prefer since/until ISO timestamps over the days fallback.",
      inputSchema: z.object({
        integrationId: z
          .string()
          .describe("The integration ID for the configured repository"),
        page: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("The page number to retrieve (starts at 1)"),
        since: z
          .string()
          .datetime()
          .optional()
          .describe("UTC ISO timestamp for the start of the range"),
        until: z
          .string()
          .datetime()
          .optional()
          .describe("UTC ISO timestamp for the end of the range"),
        days: z
          .number()
          .default(7)
          .optional()
          .describe(
            "Deprecated fallback. Prefer since/until timestamps for exact windows."
          ),
      }),
      execute: async ({ integrationId, days, page, since, until }) => {
        const resolved = await resolveIntegrationContext(integrationId);

        const octokit = createOctokit(resolved.token);
        const window = clampToCommitWindow(since, until);
        const effectiveSince = window.since ?? getISODateFromDaysAgo(days ?? 7);
        const effectiveUntil = window.until ?? new Date().toISOString();
        // A request outside the enforced window clamps to an empty range.
        if (Date.parse(effectiveSince) > Date.parse(effectiveUntil)) {
          return {
            commits: [],
            pagination: {
              page,
              perPage: 100,
              hasNextPage: false,
              nextPage: null,
            },
          };
        }
        const response = await withGitHubRateLimitHandling(() =>
          octokit.request("GET /repos/{owner}/{repo}/commits", {
            owner: resolved.owner,
            repo: resolved.repo,
            since: effectiveSince,
            page,
            ...(resolved.defaultBranch ? { sha: resolved.defaultBranch } : {}),
            until: effectiveUntil,
            per_page: 100,
            headers: GITHUB_API_VERSION_HEADERS,
          })
        );

        const nextPage = getNextPageFromLinkHeader(response.headers?.link);
        const allCommits = response.data.map((commit) => ({
          sha: commit.sha,
          message: commit.commit.message,
          authorName:
            commit.author?.login ?? commit.commit.author?.name ?? "unknown",
          authoredAt: commit.commit.author?.date ?? null,
          url: commit.html_url,
        }));

        const commits = allowedCommitShas
          ? allCommits.filter((commit) =>
              allowedCommitShas.has(commit.sha.trim().toLowerCase())
            )
          : allCommits;

        const hasNextPage =
          nextPage !== undefined &&
          !(allowedCommitShas && commits.length === 0);

        return {
          commits,
          pagination: {
            page,
            perPage: 100,
            hasNextPage,
            nextPage: hasNextPage ? (nextPage ?? null) : null,
          },
        };
      },
    }),
    {
      ttl: 2 * 60 * 1000,
      keyGenerator: (params: unknown) => {
        const { integrationId, since, until, days, page } = params as {
          integrationId: string;
          since?: string;
          until?: string;
          days?: number;
          page?: number;
        };
        const window = clampToCommitWindow(since, until);
        const cacheSince = window.since ?? "auto";
        const cacheUntil = window.until ?? "auto";
        return `get_commits_by_timeframe:integration=${integrationId}:since=${cacheSince}:until=${cacheUntil}:days=${String(days ?? "none")}:page=${String(page ?? 1)}`;
      },
    }
  );
}

interface BuildGitHubDataToolsOptions {
  organizationId: string;
  allowedIntegrationIds: string[];
  dataPointSettings?: AgentDataPointSettings;
  selectionFilters?: GitHubSelectionFilters;
  commitWindow?: CommitWindow;
  resolveContext?: ResolveIntegrationContext;
}

export function buildGitHubDataTools(
  options: BuildGitHubDataToolsOptions
): Record<string, Tool> {
  const {
    organizationId,
    allowedIntegrationIds,
    dataPointSettings,
    selectionFilters,
    commitWindow,
    resolveContext,
  } = options;

  const includePullRequests = dataPointSettings?.includePullRequests !== false;
  const includeCommits = dataPointSettings?.includeCommits !== false;
  const includeReleases = dataPointSettings?.includeReleases !== false;

  return {
    ...(includePullRequests
      ? {
          listMergedPullRequests: createListMergedPullRequestsTool(
            {
              organizationId,
              allowedIntegrationIds,
              allowedPullRequestNumbersByIntegrationId:
                selectionFilters?.allowedPullRequestNumbersByIntegrationId,
              enforcedCommitWindow: commitWindow,
            },
            resolveContext
          ),
          getPullRequests: createGetPullRequestsTool(
            {
              organizationId,
              allowedIntegrationIds,
              allowedPullRequestNumbersByIntegrationId:
                selectionFilters?.allowedPullRequestNumbersByIntegrationId,
            },
            resolveContext
          ),
        }
      : {}),
    ...(includeReleases
      ? {
          getReleaseByTag: createGetReleaseByTagTool(
            {
              organizationId,
              allowedIntegrationIds,
              allowedReleaseTagsByIntegrationId:
                selectionFilters?.allowedReleaseTagsByIntegrationId,
              allowedReleaseTagsGlobal:
                selectionFilters?.allowedReleaseTagsGlobal,
            },
            resolveContext
          ),
        }
      : {}),
    ...(includeCommits
      ? {
          getCommitsByTimeframe: createGetCommitsByTimeframeTool(
            {
              organizationId,
              allowedIntegrationIds,
              allowedCommitShas: selectionFilters?.allowedCommitShas,
              enforcedCommitWindow: commitWindow,
            },
            resolveContext
          ),
        }
      : {}),
  };
}
