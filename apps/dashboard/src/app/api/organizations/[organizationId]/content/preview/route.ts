import { db } from "@notra/db/drizzle";
import { githubIntegrations } from "@notra/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withOrganizationAuth } from "@/lib/auth/organization";
import { createOctokit } from "@/lib/octokit";
import { getTokenForIntegrationId } from "@/lib/services/github-integration";
import { LOOKBACK_WINDOWS } from "@/schemas/integrations";
import { resolveLookbackRange } from "@/utils/lookback";

const MAX_COMMITS = 50;
const MAX_PULL_REQUESTS = 30;
const MAX_RELEASES = 20;

const previewRequestSchema = z.object({
  repositoryIds: z.array(z.string().min(1)).min(1),
  lookbackWindow: z.enum(LOOKBACK_WINDOWS),
  includeCommits: z.boolean().default(true),
  includePullRequests: z.boolean().default(true),
  includeReleases: z.boolean().default(true),
});

interface CommitPreview {
  sha: string;
  message: string;
  authorName: string;
  authoredAt: string;
  htmlUrl: string;
}

interface PullRequestPreview {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  authorLogin: string;
  mergedAt: string | null;
  htmlUrl: string;
}

interface ReleasePreview {
  tagName: string;
  name: string;
  publishedAt: string;
  authorLogin: string;
  htmlUrl: string;
  prerelease: boolean;
}

interface RepositoryPreview {
  repositoryId: string;
  owner: string;
  repo: string;
  commits: CommitPreview[];
  pullRequests: PullRequestPreview[];
  releases: ReleasePreview[];
}

type PreviewFailureStage =
  | "repository_lookup"
  | "repository_metadata"
  | "token"
  | "commits"
  | "pull_requests"
  | "releases";

interface RepositoryPreviewFailure {
  repositoryId: string;
  owner: string | null;
  repo: string | null;
  stage: PreviewFailureStage;
  message: string;
}

interface RouteContext {
  params: Promise<{ organizationId: string }>;
}

function formatFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown error";
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { organizationId } = await params;
  const auth = await withOrganizationAuth(request, organizationId);

  if (!auth.success) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const validation = previewRequestSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.issues },
      { status: 400 }
    );
  }

  const {
    repositoryIds,
    lookbackWindow,
    includeCommits,
    includePullRequests,
    includeReleases,
  } = validation.data;
  const lookback = resolveLookbackRange(lookbackWindow);

  const repositories = await db
    .select({
      id: githubIntegrations.id,
      owner: githubIntegrations.owner,
      repo: githubIntegrations.repo,
    })
    .from(githubIntegrations)
    .where(
      and(
        eq(githubIntegrations.organizationId, organizationId),
        eq(githubIntegrations.enabled, true),
        inArray(githubIntegrations.id, repositoryIds)
      )
    );

  const failures: RepositoryPreviewFailure[] = [];
  const repoById = new Map(
    repositories.map((repository) => [repository.id, repository])
  );

  for (const repositoryId of repositoryIds) {
    if (!repoById.has(repositoryId)) {
      failures.push({
        repositoryId,
        owner: null,
        repo: null,
        stage: "repository_lookup",
        message: "Repository was not found or is not enabled",
      });
    }
  }

  const validRepos = repositories.filter(
    (
      repo
    ): repo is (typeof repositories)[number] & {
      owner: string;
      repo: string;
    } => {
      if (repo.owner && repo.repo) {
        return true;
      }
      failures.push({
        repositoryId: repo.id,
        owner: repo.owner,
        repo: repo.repo,
        stage: "repository_metadata",
        message: "Repository is missing owner or name",
      });
      return false;
    }
  );

  const repositoryResults = await Promise.all(
    validRepos.map(async (repo) => {
      let token: string | null = null;
      try {
        token = await getTokenForIntegrationId(repo.id);
      } catch (error) {
        return {
          repository: null,
          failures: [
            {
              repositoryId: repo.id,
              owner: repo.owner,
              repo: repo.repo,
              stage: "token" as const,
              message: formatFailureMessage(error),
            },
          ],
        };
      }

      const octokit = createOctokit(token ?? undefined);
      const [commitsResult, pullsResult, releasesResult] =
        await Promise.allSettled([
          includeCommits
            ? octokit.request("GET /repos/{owner}/{repo}/commits", {
                owner: repo.owner,
                repo: repo.repo,
                since: lookback.start.toISOString(),
                until: lookback.end.toISOString(),
                per_page: MAX_COMMITS,
                headers: { "X-GitHub-Api-Version": "2022-11-28" },
              })
            : Promise.resolve({ data: [] }),
          includePullRequests
            ? octokit.request("GET /repos/{owner}/{repo}/pulls", {
                owner: repo.owner,
                repo: repo.repo,
                state: "closed",
                sort: "updated",
                direction: "desc",
                per_page: 100,
                headers: { "X-GitHub-Api-Version": "2022-11-28" },
              })
            : Promise.resolve({ data: [] }),
          includeReleases
            ? octokit.request("GET /repos/{owner}/{repo}/releases", {
                owner: repo.owner,
                repo: repo.repo,
                per_page: 100,
                headers: { "X-GitHub-Api-Version": "2022-11-28" },
              })
            : Promise.resolve({ data: [] }),
        ]);

      const repoFailures: RepositoryPreviewFailure[] = [];

      const commits: CommitPreview[] =
        commitsResult.status === "fulfilled"
          ? commitsResult.value.data.map((c) => ({
              sha: c.sha,
              message: c.commit.message.split("\n")[0] ?? "",
              authorName: c.commit.author?.name ?? "Unknown",
              authoredAt: c.commit.author?.date ?? "",
              htmlUrl: c.html_url,
            }))
          : [];

      if (commitsResult.status === "rejected") {
        repoFailures.push({
          repositoryId: repo.id,
          owner: repo.owner,
          repo: repo.repo,
          stage: "commits",
          message: formatFailureMessage(commitsResult.reason),
        });
      }

      const pullRequests: PullRequestPreview[] =
        pullsResult.status === "fulfilled"
          ? pullsResult.value.data
              .filter((pr) => {
                if (!pr.merged_at) {
                  return false;
                }
                const mergedDate = new Date(pr.merged_at);
                return (
                  mergedDate >= lookback.start && mergedDate <= lookback.end
                );
              })
              .slice(0, MAX_PULL_REQUESTS)
              .map((pr) => ({
                number: pr.number,
                title: pr.title,
                state: pr.state,
                merged: !!pr.merged_at,
                authorLogin: pr.user?.login ?? "Unknown",
                mergedAt: pr.merged_at ?? null,
                htmlUrl: pr.html_url,
              }))
          : [];

      if (pullsResult.status === "rejected") {
        repoFailures.push({
          repositoryId: repo.id,
          owner: repo.owner,
          repo: repo.repo,
          stage: "pull_requests",
          message: formatFailureMessage(pullsResult.reason),
        });
      }

      const releases: ReleasePreview[] =
        releasesResult.status === "fulfilled"
          ? releasesResult.value.data
              .filter((release) => {
                if (!release.published_at) {
                  return false;
                }
                const publishedDate = new Date(release.published_at);
                return (
                  publishedDate >= lookback.start &&
                  publishedDate <= lookback.end
                );
              })
              .slice(0, MAX_RELEASES)
              .map((release) => ({
                tagName: release.tag_name,
                name: release.name ?? release.tag_name,
                publishedAt: release.published_at ?? "",
                authorLogin: release.author?.login ?? "Unknown",
                htmlUrl: release.html_url,
                prerelease: release.prerelease,
              }))
          : [];

      if (releasesResult.status === "rejected") {
        repoFailures.push({
          repositoryId: repo.id,
          owner: repo.owner,
          repo: repo.repo,
          stage: "releases",
          message: formatFailureMessage(releasesResult.reason),
        });
      }

      return {
        repository: {
          repositoryId: repo.id,
          owner: repo.owner,
          repo: repo.repo,
          commits,
          pullRequests,
          releases,
        } satisfies RepositoryPreview,
        failures: repoFailures,
      };
    })
  );

  const results = repositoryResults
    .map((result) => {
      failures.push(...result.failures);
      return result.repository;
    })
    .filter(
      (repository): repository is RepositoryPreview => repository !== null
    );

  return NextResponse.json({ repositories: results, failures });
}
