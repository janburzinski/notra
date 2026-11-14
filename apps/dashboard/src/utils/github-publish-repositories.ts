import { DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED } from "@/constants/github";
import type { GitHubRepository } from "@/types/integrations";
import type { GitHubPublishContentType } from "@/types/integrations/github";

export function getGitHubPublishRepositoryLists(
  integrations: Array<{
    enabled: boolean;
    repositories: GitHubRepository[];
    type?: string;
  }>
) {
  const connected: GitHubRepository[] = [];
  const publishable: GitHubRepository[] = [];

  for (const integration of integrations) {
    if (integration.type !== "github" || !integration.enabled) {
      continue;
    }

    for (const repository of integration.repositories) {
      if (!repository.enabled) {
        continue;
      }

      connected.push(repository);
      if (repository.defaultBranch) {
        publishable.push(repository);
      }
    }
  }

  return { connected, publishable };
}

export function isGitHubContentPublishingEnabled(
  repository: GitHubRepository,
  contentType: GitHubPublishContentType
): boolean {
  const output = repository.outputs?.find(
    (candidate) => candidate.outputType === contentType
  );

  return output?.enabled ?? DEFAULT_GITHUB_CONTENT_OUTPUT_ENABLED[contentType];
}

export function formatGitHubRepositoryLabel(
  repository: Pick<GitHubRepository, "owner" | "repo">
) {
  return `${repository.owner}/${repository.repo}`;
}

/**
 * The repository to preselect: the preferred one when it is still listed,
 * otherwise the first one that accepts this content, so the dialog does not
 * open on a repository where publishing is off.
 */
export function resolveGitHubPublishRepositoryId<
  T extends Pick<GitHubRepository, "id">,
>(
  preferredId: string | null | undefined,
  repositories: readonly T[],
  canPublish?: (repository: T) => boolean
) {
  if (
    preferredId &&
    repositories.some((repository) => repository.id === preferredId)
  ) {
    return preferredId;
  }

  const fallback =
    (canPublish ? repositories.find(canPublish) : undefined) ?? repositories[0];
  return fallback?.id ?? "";
}
