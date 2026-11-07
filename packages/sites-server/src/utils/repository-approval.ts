import { githubAppInstallations, githubIntegrations } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import type { RepositoryApprovalRefs } from "../types/github";

/**
 * The workspace still approves this repository through an enabled GitHub App
 * installation. Takes values or columns; join githubIntegrations to
 * githubAppInstallations to use it.
 */
export function repositoryApproval(repository: RepositoryApprovalRefs) {
  return and(
    eq(githubIntegrations.id, repository.integrationId),
    eq(githubIntegrations.organizationId, repository.organizationId),
    eq(githubAppInstallations.organizationId, repository.organizationId),
    eq(githubIntegrations.githubRepositoryId, repository.githubRepositoryId),
    eq(githubIntegrations.owner, repository.owner),
    eq(githubIntegrations.repo, repository.repo),
    eq(githubAppInstallations.installationId, repository.installationId),
    eq(githubIntegrations.enabled, true),
    eq(githubIntegrations.repositoryEnabled, true),
    eq(githubAppInstallations.enabled, true)
  );
}
