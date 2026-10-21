import { GITHUB_API_VERSION_HEADERS } from "@notra/ai/constants/github";
import { db } from "@notra/db/drizzle";
import { siteBranchDrafts as siteDrafts } from "@notra/db/schema";
import { SITE_EDIT_BRANCH_PREFIX } from "@notra/sites-core/constants/sites";
import { and, eq } from "drizzle-orm";

import {
  BRANCH_PROTECTION_CACHE_MS,
  BRANCH_PR_PAGE_LIMIT,
  READY_FOR_REVIEW_MUTATION,
} from "./constants/branches";
import {
  createRepositoryBranch,
  flushSiteDrafts,
  listSiteDrafts,
  validateSiteDrafts,
} from "./editor";
import { SiteInputError } from "./errors";
import { getBranchHead, siteRepositoryAccess } from "./github";
import type {
  BranchProtectionCacheEntry,
  CreateSiteBranchInput,
} from "./types/branches";
import type { SiteRepository } from "./types/github";
import type { Site } from "./types/sites";
import { createSiteBranchOctokit as createOctokit } from "./utils/branch-octokit";
import { requiresPullRequest } from "./utils/branch-protection";
import { branchPullRequest, canMergeBranch } from "./utils/branch-pull-request";
import { errorMessage, isNotFoundError } from "./utils/errors";
import { moveSiteBranchDrafts } from "./utils/move-site-branch-drafts";
import {
  lockSiteBranchEdits,
  withSiteBranchLock,
} from "./utils/site-branch-lock";
import {
  assertSiteFeatureBranch,
  assertSiteEditableBranch,
  siteEditBranchName,
} from "./utils/site-edit-branch";

const protectionCache = new Map<string, BranchProtectionCacheEntry>();

export async function siteBranchStatus(
  site: Site,
  branch = site.productionBranch
) {
  assertSiteEditableBranch(site, branch);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
    pull_requests: "read",
  });
  let head;
  try {
    head = await getBranchHead(repository, token, branch);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new SiteInputError("Branch not found");
    }
    // An ambiguous protection result must still offer Create branch.
    return {
      branch,
      canPublishDirect: false,
      canEdit: false,
      protected: true,
      pullRequest: null,
      canMerge: false,
      hasFeatureBranches: false,
    };
  }
  const cacheKey = JSON.stringify([
    site.id,
    site.repositoryId,
    site.productionBranch,
  ]);
  const cached = protectionCache.get(cacheKey);
  const allowed =
    cached &&
    cached.expires > Date.now() &&
    !(
      branch === site.productionBranch &&
      head.protected !== false &&
      cached.allowed
    )
      ? cached.allowed
      : !(await requiresPullRequest(repository, token, site.productionBranch));
  if (protectionCache.size > 1000) {
    protectionCache.clear();
  }
  protectionCache.set(cacheKey, {
    allowed,
    expires:
      cached && cached.expires > Date.now()
        ? cached.expires
        : Date.now() + BRANCH_PROTECTION_CACHE_MS,
  });
  const pr =
    branch === site.productionBranch
      ? null
      : await branchPullRequest(
          repository,
          token,
          branch,
          site.productionBranch
        );
  return {
    branch,
    canPublishDirect: allowed,
    canEdit:
      branch === site.productionBranch ||
      !(await requiresPullRequest(repository, token, branch)),
    protected: head.protected,
    pullRequest: pr,
    canMerge: canMergeBranch(pr),
    hasFeatureBranches:
      (await octokitFeatureRefs(repository, token)).length > 0,
  };
}

export async function listSiteBranches(site: Site, search = "") {
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
    pull_requests: "read",
  });
  const octokit = createOctokit(token);
  const params = {
    owner: repository.owner,
    repo: repository.repo,
    headers: GITHUB_API_VERSION_HEADERS,
    per_page: 100,
  };
  const branches = new Map<
    string,
    {
      name: string;
      status: "draft" | "open" | "merged" | "closed" | null;
      exists: boolean;
    }
  >();
  branches.set(site.productionBranch, {
    name: site.productionBranch,
    status: null,
    exists: true,
  });
  for (const entry of await octokitFeatureRefs(repository, token)) {
    const name = entry.ref.replace("refs/heads/", "");
    if (name.startsWith(SITE_EDIT_BRANCH_PREFIX)) {
      branches.set(name, { name, status: null, exists: true });
    }
  }
  for (let page = 1; page <= BRANCH_PR_PAGE_LIMIT; page++) {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      ...params,
      base: site.productionBranch,
      state: "all",
      sort: "created",
      direction: "desc",
      page,
    });
    for (const pr of data) {
      if (
        pr.head.repo?.full_name !== `${repository.owner}/${repository.repo}`
      ) {
        continue;
      }
      const name = pr.head.ref;
      if (!name.startsWith(SITE_EDIT_BRANCH_PREFIX)) {
        continue;
      }
      const existing = branches.get(name);
      if (existing?.status) {
        continue;
      }
      branches.set(name, {
        name,
        exists: existing?.exists ?? false,
        status: pr.merged_at
          ? "merged"
          : pr.state === "closed"
            ? "closed"
            : pr.draft
              ? "draft"
              : "open",
      });
    }
    if (data.length < 100) {
      break;
    }
  }
  const orphaned = await db
    .selectDistinct({ branch: siteDrafts.branch })
    .from(siteDrafts)
    .where(eq(siteDrafts.siteId, site.id));
  for (const { branch } of orphaned) {
    if (branch.startsWith(SITE_EDIT_BRANCH_PREFIX) && !branches.has(branch)) {
      branches.set(branch, { name: branch, status: null, exists: false });
    }
  }
  return [...branches.values()]
    .filter((entry) => entry.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      a.name === site.productionBranch
        ? -1
        : b.name === site.productionBranch
          ? 1
          : a.name.localeCompare(b.name)
    );
}

export async function createSiteBranch(
  site: Site,
  input: CreateSiteBranchInput
) {
  const source = input.branch ?? site.productionBranch;
  assertSiteEditableBranch(site, source);
  const branch = siteEditBranchName(input.title);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  await withSiteBranchLock(site.id, source, async (tx) => {
    const head = await getBranchHead(repository, token, source);
    const drafts = input.bringChanges
      ? await listSiteDrafts(site.id, source, tx)
      : [];
    await createRepositoryBranch(repository, token, {
      name: branch,
      sha: head.sha,
    });
    if (drafts.length > 0) {
      await tx.insert(siteDrafts).values(
        drafts.map((draft) => ({
          ...draft,
          id: `drf_${crypto.randomUUID()}`,
          branch,
          revision: 0,
          committedRevision: null,
          updatedByUserId: input.userId,
        }))
      );
    }
  });
  // The copy is durable before flushing. A failed GitHub write leaves recoverable drafts on both branches.
  let flushError: string | null = null;
  if (input.bringChanges) {
    try {
      await flushSiteDrafts(site, {
        branch,
        message: "Update site content",
        userId: input.userId,
      });
    } catch (error) {
      flushError = errorMessage(error);
    }
  }
  return { branch, flushError };
}

export async function renameSiteBranch(
  site: Site,
  branch: string,
  title: string
) {
  assertSiteFeatureBranch(site, branch);
  const name = siteEditBranchName(title);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "read",
  });
  assertSiteFeatureBranch(site, name);
  let renamed = false;
  let renameAttempted = false;
  const rename = async (from: string, to: string) => {
    try {
      await createOctokit(token).request(
        "POST /repos/{owner}/{repo}/branches/{branch}/rename",
        {
          owner: repository.owner,
          repo: repository.repo,
          branch: from,
          new_name: to,
          headers: GITHUB_API_VERSION_HEADERS,
        }
      );
    } catch (error) {
      if (
        error instanceof Error &&
        [403, 404].includes(Reflect.get(error, "status"))
      ) {
        throw new SiteInputError(
          "GitHub could not rename this branch. Grant the Notra GitHub App Contents: write, or ask a repository admin to rename a default or protected branch."
        );
      }
      throw error;
    }
  };
  // After an ambiguous GitHub response, keep drafts on the one ref that still exists.
  const reconcileRename = () =>
    withSiteBranchLock(
      site.id,
      branch,
      async (tx) => {
        await lockSiteBranchEdits(tx, site.id, name, true);
        const [oldHead, newHead] = await Promise.all(
          [branch, name].map((ref) =>
            createOctokit(token)
              .request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
                owner: repository.owner,
                repo: repository.repo,
                ref: `heads/${ref}`,
                headers: GITHUB_API_VERSION_HEADERS,
              })
              .catch((readError: unknown) => {
                if (isNotFoundError(readError)) {
                  return null;
                }
                throw readError;
              })
          )
        );
        if (!oldHead && newHead) {
          await moveSiteBranchDrafts(tx, site.id, branch, name);
          return name;
        }
        return oldHead ? branch : null;
      },
      true
    );
  try {
    await withSiteBranchLock(
      site.id,
      branch,
      async (tx) => {
        await lockSiteBranchEdits(tx, site.id, name, true);
        const existing = await tx
          .select({ id: siteDrafts.id })
          .from(siteDrafts)
          .where(
            and(eq(siteDrafts.siteId, site.id), eq(siteDrafts.branch, name))
          )
          .limit(1);
        if (existing.length) {
          throw new SiteInputError(
            "The target branch already has drafts. Discard those drafts or choose another name."
          );
        }
        const pr = await branchPullRequest(repository, token, branch);
        if (pr?.state === "OPEN") {
          throw new SiteInputError(
            "This branch has an open pull request. Merge or close it before renaming to preserve its reviews and discussion."
          );
        }
        renameAttempted = true;
        await rename(branch, name);
        renamed = true;
        await moveSiteBranchDrafts(tx, site.id, branch, name);
      },
      true
    );
  } catch (error) {
    if (!renamed) {
      if (renameAttempted && (await reconcileRename()) === name) {
        return { branch: name };
      }
      throw error;
    }
    // The transaction rolled back, so keep the old rows and restore their GitHub branch.
    try {
      await rename(name, branch);
    } catch {
      // The compensation may have landed without a response; follow whichever ref GitHub kept.
      if ((await reconcileRename()) === name) {
        return { branch: name };
      }
    }
    throw error;
  }
  return { branch: name };
}

export async function deleteSiteBranch(site: Site, branch: string) {
  assertSiteFeatureBranch(site, branch);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      const pr = await branchPullRequest(
        repository,
        token,
        branch,
        site.productionBranch
      );
      if (pr?.state === "OPEN") {
        await createOctokit(token).request(
          "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
          {
            owner: repository.owner,
            repo: repository.repo,
            pull_number: pr.number,
            state: "closed",
            headers: GITHUB_API_VERSION_HEADERS,
          }
        );
      }
      await createOctokit(token).request(
        "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
        {
          owner: repository.owner,
          repo: repository.repo,
          ref: `heads/${branch}`,
          headers: GITHUB_API_VERSION_HEADERS,
        }
      );
      await tx
        .delete(siteDrafts)
        .where(
          and(eq(siteDrafts.siteId, site.id), eq(siteDrafts.branch, branch))
        );
    },
    true
  );
}

export async function requestSiteBranchReview(site: Site, branch: string) {
  assertSiteFeatureBranch(site, branch);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
    pull_requests: "write",
  });
  const pr = await branchPullRequest(
    repository,
    token,
    branch,
    site.productionBranch
  );
  if (!pr || pr.state !== "OPEN" || !pr.isDraft) {
    throw new SiteInputError("This branch has no draft pull request");
  }
  await createOctokit(token).graphql(READY_FOR_REVIEW_MUTATION, { id: pr.id });
}

export async function mergeSiteBranch(site: Site, branch: string) {
  assertSiteFeatureBranch(site, branch);
  if (branch === site.productionBranch) {
    throw new SiteInputError("Choose a feature branch");
  }
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  const validatedHead = await getBranchHead(repository, token, branch);
  const validation = await validateSiteDrafts(site, branch, validatedHead.sha);
  if (!validation.ok) {
    throw new SiteInputError("Fix the validation errors before merging");
  }
  return await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      if ((await listSiteDrafts(site.id, branch, tx)).length > 0) {
        throw new SiteInputError(
          "Wait for all branch changes to save before merging"
        );
      }
      const pr = await branchPullRequest(
        repository,
        token,
        branch,
        site.productionBranch
      );
      if (pr?.mergeable === "CONFLICTING") {
        throw new SiteInputError(
          "Resolve this branch's merge conflicts on GitHub before merging."
        );
      }
      if (!pr || !canMergeBranch(pr) || pr.headRefOid !== validatedHead.sha) {
        throw new SiteInputError(
          "GitHub has not allowed this pull request to merge"
        );
      }
      const octokit = createOctokit(token);
      const params = {
        owner: repository.owner,
        repo: repository.repo,
        headers: GITHUB_API_VERSION_HEADERS,
      };
      for (const method of ["squash", "merge", "rebase"] as const) {
        try {
          const { data } = await octokit.request(
            "PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge",
            {
              ...params,
              pull_number: pr.number,
              sha: pr.headRefOid,
              merge_method: method,
            }
          );
          if (!data.merged) {
            throw new SiteInputError("GitHub did not merge the pull request");
          }
          return { branch: site.productionBranch, commitSha: data.sha };
        } catch (error) {
          if (
            !(error instanceof Error) ||
            Reflect.get(error, "status") !== 405 ||
            method === "rebase"
          ) {
            throw error;
          }
        }
      }
      throw new SiteInputError("GitHub did not allow any merge method");
    },
    true
  );
}

async function octokitFeatureRefs(repository: SiteRepository, token: string) {
  const { data } = await createOctokit(token).request(
    "GET /repos/{owner}/{repo}/git/matching-refs/{ref}",
    {
      owner: repository.owner,
      repo: repository.repo,
      ref: `heads/${SITE_EDIT_BRANCH_PREFIX}`,
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  return data;
}

export async function discardDeletedSiteBranchDrafts(
  site: Site,
  branch: string
) {
  assertSiteFeatureBranch(site, branch);
  const { repository, token } = await siteRepositoryAccess(site, {
    contents: "read",
  });
  await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      try {
        await getBranchHead(repository, token, branch);
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
        await tx
          .delete(siteDrafts)
          .where(
            and(eq(siteDrafts.siteId, site.id), eq(siteDrafts.branch, branch))
          );
        return;
      }
      throw new SiteInputError("This branch still exists on GitHub");
    },
    true
  );
}
