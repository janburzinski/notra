import { SITE_EDIT_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";
import { isValidGitBranch } from "@notra/sites-core/utils/git-branch";

import { SiteInputError } from "../errors";
import type { Site } from "../types/sites";
import { timestampedBranchName } from "./branch-name";

export function assertSiteFeatureBranch(site: Site, branch: string) {
  if (branch === site.productionBranch) {
    throw new SiteInputError(
      "The deployment branch cannot be renamed or deleted"
    );
  }
  if (
    !branch.startsWith(SITE_EDIT_BRANCH_PREFIX) ||
    !isValidGitBranch(branch)
  ) {
    throw new SiteInputError(
      "Only Notra site edit branches can be renamed or deleted"
    );
  }
}

export function assertSiteEditableBranch(site: Site, branch: string) {
  if (
    !isValidGitBranch(branch) ||
    (branch !== site.productionBranch &&
      !branch.startsWith(SITE_EDIT_BRANCH_PREFIX))
  ) {
    throw new SiteInputError("Branch not found");
  }
}

export function siteEditBranchName(title: string) {
  if (!title.trim()) {
    return `${timestampedBranchName(SITE_EDIT_BRANCH_PREFIX, new Date())}-${crypto.randomUUID().slice(0, 6)}`;
  }
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new SiteInputError(
      "Enter a branch name containing letters or numbers"
    );
  }
  const name = `${SITE_EDIT_BRANCH_PREFIX}${slug}`;
  if (!isValidGitBranch(name)) {
    throw new SiteInputError("Enter a valid branch name");
  }
  return name;
}
