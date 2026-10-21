import {
  GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION,
  GITHUB_API_VERSION_HEADERS,
} from "@notra/ai/constants/github";
import { db } from "@notra/db/drizzle";
import { sites } from "@notra/db/schema";
import { validateSite } from "@notra/sites-compiler/validate";
import { SITE_CONFIG_FILENAME } from "@notra/sites-core/constants/sites";
import {
  SITE_IGNORE_FILENAME,
  SITE_IGNORE_MAX_BYTES,
} from "@notra/sites-core/constants/source";
import { createDefaultSiteConfig } from "@notra/sites-core/utils/default-config";
import { createSiteIgnore } from "@notra/sites-core/utils/site-ignore";
import {
  isCollectedSiteSourcePath,
  isSiteSourcePath,
} from "@notra/sites-core/utils/source-files";
import { and, eq, sql, or, isNull } from "drizzle-orm";

import {
  DEFAULT_PUBLISH_HEADLINE,
  EDITABLE_PATH_SEGMENT,
  EDITABLE_TEXT_FILE,
  MAX_DRAFT_BYTES,
  MAX_PUBLISH_HEADLINE_LENGTH,
  SITE_EDITOR_READ_CONCURRENCY,
  VALIDATED_SOURCE_FILE,
} from "./constants/editor";
import { SiteInputError, SitePublishConflictError } from "./errors";
import { getBranchHead, siteRepositoryAccess } from "./github";
import type { SiteStorageTransaction } from "./types/deployments";
import type {
  CreateCommitOnBranchResponse,
  PublishSiteDraftsInput,
  PublishSiteDraftsResult,
  RepositoryCommitInput,
  RepositoryPullRequestInput,
  RepositoryFileRef,
  RepositoryBranchInput,
  SaveSiteDraftInput,
  SiteDraftMutationInput,
  SiteDraft,
  SiteSourceEntry,
  SiteSourceFileContent,
  SiteSourceListing,
} from "./types/editor";
import type { SiteRepositoryAccess, SiteRepository } from "./types/github";
import type { Site } from "./types/sites";
import { createSiteBranchOctokit as createOctokit } from "./utils/branch-octokit";
import { requiresPullRequest } from "./utils/branch-protection";
import { branchPullRequest } from "./utils/branch-pull-request";
import { mapWithConcurrency } from "./utils/concurrency";
import { errorMessage, isNotFoundError } from "./utils/errors";
import { prefixedId } from "./utils/ids";
import { repositoryPath } from "./utils/root-directory";
import {
  lockSiteBranchEdits,
  withSiteBranchLock,
} from "./utils/site-branch-lock";
import { siteDraftTable } from "./utils/site-draft-table";
import { assertSiteEditableBranch } from "./utils/site-edit-branch";

// createCommitOnBranch rejects a stale expectedHeadOid with "Expected branch to
// point to "<oid>" but it did not". Anything else is a real failure.
const STALE_HEAD_ERROR_PATTERN = /expected branch to point to/i;

function assertEditablePath(path: string): void {
  if (path === SITE_IGNORE_FILENAME) {
    return;
  }
  const editable =
    isSiteSourcePath(path) &&
    EDITABLE_TEXT_FILE.test(path) &&
    path
      .split("/")
      .every(
        (segment) =>
          !segment.startsWith(".") && EDITABLE_PATH_SEGMENT.test(segment)
      );
  if (!editable) {
    throw new SiteInputError(`${path} is not an editable site file`);
  }
}

function readAccess(site: Site) {
  return siteRepositoryAccess(site, { contents: "read" });
}

export async function listSiteSourceFiles(
  site: Site,
  branch = site.productionBranch,
  access?: SiteRepositoryAccess,
  commitSha?: string
): Promise<SiteSourceListing> {
  assertSiteEditableBranch(site, branch);
  const { repository, token } = access ?? (await readAccess(site));
  const headSha =
    commitSha ?? (await getBranchHead(repository, token, branch)).sha;
  const { data: tree } = await createOctokit(token).request(
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    {
      owner: repository.owner,
      repo: repository.repo,
      tree_sha: headSha,
      recursive: "1",
      headers: GITHUB_API_VERSION_HEADERS,
    }
  );
  const prefix = site.rootDirectory ? `${site.rootDirectory}/` : "";
  if (tree.truncated) {
    throw new SiteInputError(
      "The repository file listing is incomplete. Choose a smaller site repository before validating or publishing."
    );
  }
  const files: SiteSourceEntry[] = [];
  for (const entry of tree.tree) {
    if (!entry.path || !entry.path.startsWith(prefix)) {
      continue;
    }
    const path = entry.path.slice(prefix.length);
    if (path === SITE_IGNORE_FILENAME) {
      if (
        entry.type !== "blob" ||
        !entry.sha ||
        !["100644", "100755"].includes(entry.mode ?? "") ||
        entry.size === undefined ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        entry.size > SITE_IGNORE_MAX_BYTES
      ) {
        throw new SiteInputError(
          `${SITE_IGNORE_FILENAME} must be a regular file of at most ${SITE_IGNORE_MAX_BYTES / 1024} KB`
        );
      }
    } else if (
      entry.type !== "blob" ||
      !entry.sha ||
      (entry.mode !== undefined &&
        !["100644", "100755"].includes(entry.mode)) ||
      !isCollectedSiteSourcePath(path)
    ) {
      continue;
    }
    files.push({ path, sha: entry.sha, size: entry.size ?? 0 });
  }
  return {
    commitSha: headSha,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export async function readSiteSourceFile(
  site: Site,
  path: string,
  ref = site.productionBranch,
  access?: SiteRepositoryAccess
): Promise<SiteSourceFileContent | null> {
  if (!access) {
    assertSiteEditableBranch(site, ref);
  }
  assertEditablePath(path);
  const { repository, token } = access ?? (await readAccess(site));
  return await readRepositoryFile(repository, token, {
    path: repositoryPath(site.rootDirectory, path),
    ref,
  });
}

export async function readRepositoryFile(
  repository: SiteRepository,
  token: string,
  file: RepositoryFileRef
): Promise<SiteSourceFileContent | null> {
  const octokit = createOctokit(token);
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: repository.owner,
        repo: repository.repo,
        path: file.path,
        ref: file.ref,
        headers: GITHUB_API_VERSION_HEADERS,
      }
    );
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      return null;
    }
    return {
      content: Buffer.from(data.content, "base64").toString("utf8"),
      sha: data.sha,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function createRepositoryBranch(
  repository: SiteRepository,
  token: string,
  branch: RepositoryBranchInput
): Promise<void> {
  await createOctokit(token).request("POST /repos/{owner}/{repo}/git/refs", {
    owner: repository.owner,
    repo: repository.repo,
    ref: `refs/heads/${branch.name}`,
    sha: branch.sha,
    headers: GITHUB_API_VERSION_HEADERS,
  });
}

export async function commitRepositoryFiles(
  repository: SiteRepository,
  token: string,
  commit: RepositoryCommitInput
): Promise<string> {
  const result = await createOctokit(
    token
  ).graphql<CreateCommitOnBranchResponse>(
    GITHUB_CREATE_COMMIT_ON_BRANCH_MUTATION,
    {
      input: {
        branch: {
          repositoryNameWithOwner: `${repository.owner}/${repository.repo}`,
          branchName: commit.branch,
        },
        message: { headline: commit.headline },
        expectedHeadOid: commit.expectedHeadOid,
        fileChanges: {
          additions: commit.additions.map((file) => ({
            path: file.path,
            contents: Buffer.from(file.content).toString("base64"),
          })),
          deletions: commit.deletions.map((path) => ({ path })),
        },
      },
    }
  );
  return result.createCommitOnBranch.commit.oid;
}

export async function openRepositoryPullRequest(
  repository: SiteRepository,
  token: string,
  pullRequest: RepositoryPullRequestInput
): Promise<string> {
  const octokit = createOctokit(token);
  const params = {
    owner: repository.owner,
    repo: repository.repo,
    title: pullRequest.title,
    head: pullRequest.head,
    base: pullRequest.base,
    body: pullRequest.body,
    headers: GITHUB_API_VERSION_HEADERS,
  };
  try {
    const { data } = await octokit.request("POST /repos/{owner}/{repo}/pulls", {
      ...params,
      draft: pullRequest.draft ?? false,
    });
    return data.html_url;
  } catch (error) {
    if (
      !pullRequest.draft ||
      !(error instanceof Error) ||
      Reflect.get(error, "status") !== 422 ||
      !/draft pull requests? (?:are |is )?not supported/i.test(error.message)
    ) {
      if (error instanceof Error && /no commits between/i.test(error.message)) {
        throw new SiteInputError(
          "No commits between this branch and the deployment branch. Save a change before opening a pull request."
        );
      }
      throw error;
    }
    const { data } = await octokit.request(
      "POST /repos/{owner}/{repo}/pulls",
      params
    );
    return data.html_url;
  }
}

export async function listSiteDrafts(
  siteId: string,
  branch?: string,
  storage: Pick<typeof db, "select"> = db
): Promise<SiteDraft[]> {
  const [site] = await storage
    .select({ productionBranch: sites.productionBranch })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  if (!site) {
    return [];
  }
  const activeBranch = branch ?? site.productionBranch;
  const siteDrafts = siteDraftTable(activeBranch, site.productionBranch);
  return await storage
    .select()
    .from(siteDrafts)
    .where(
      and(
        eq(siteDrafts.siteId, siteId),
        eq(siteDrafts.branch, activeBranch),
        or(
          isNull(siteDrafts.committedRevision),
          sql`${siteDrafts.revision} > ${siteDrafts.committedRevision}`
        )
      )
    );
}

async function lockSourceContext(
  tx: SiteStorageTransaction,
  siteId: string,
  input: Pick<SiteDraftMutationInput, "path" | "sourceContext">,
  action: "saving" | "discarding"
): Promise<void> {
  const [current] = await tx
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .for("update");
  if (
    !current ||
    (current.githubRepositoryId ?? "") !== input.sourceContext.repositoryId ||
    current.productionBranch !== input.sourceContext.productionBranch ||
    current.rootDirectory !== input.sourceContext.rootDirectory
  ) {
    throw new SitePublishConflictError(
      [input.path],
      `The site's source changed. Reload the editor before ${action}.`
    );
  }
}

export async function saveSiteDraft(
  site: Site,
  input: SaveSiteDraftInput,
  rebase = false
): Promise<SiteDraft> {
  assertEditablePath(input.path);
  if (Buffer.byteLength(input.content, "utf8") > MAX_DRAFT_BYTES) {
    throw new SiteInputError("This file is too large to edit in the browser");
  }
  const branch = input.branch ?? site.productionBranch;
  assertSiteEditableBranch(site, branch);
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  const access =
    branch === site.productionBranch ? null : await readAccess(site);
  return await db.transaction(async (tx) => {
    await lockSiteBranchEdits(tx, site.id, branch);
    if (access) {
      await getBranchHead(access.repository, access.token, branch);
      if (await requiresPullRequest(access.repository, access.token, branch)) {
        throw new SiteInputError(
          "This branch requires a new branch before editing can be published."
        );
      }
    }
    // A flush can consume this exact revision while the UPDATE waits for its
    // row lock. Keep its content so recreation can prove GitHub accepted it.
    const [observed] =
      input.draftId !== null && branch === site.productionBranch
        ? await tx
            .select()
            .from(siteDrafts)
            .where(
              and(
                eq(siteDrafts.siteId, site.id),
                eq(siteDrafts.branch, branch),
                eq(siteDrafts.path, input.path),
                eq(siteDrafts.id, input.draftId),
                eq(siteDrafts.revision, input.draftRevision ?? -1)
              )
            )
            .limit(1)
        : [];
    await lockSourceContext(tx, site.id, input, "saving");
    if ((input.draftId === null) !== (input.draftRevision === null)) {
      throw new SiteInputError(
        "A draft ID and revision must be supplied together"
      );
    }
    const values = {
      content: input.content,
      baseBlobSha: input.baseBlobSha,
      baseCommitSha: input.baseCommitSha,
      deleted: input.deleted ?? false,
      updatedByUserId: input.userId,
    };
    let [draft] =
      input.draftId === null
        ? await tx
            .insert(siteDrafts)
            .values({
              id: prefixedId("drf"),
              siteId: site.id,
              branch: input.branch ?? site.productionBranch,
              path: input.path,
              ...values,
            })
            .onConflictDoUpdate({
              target:
                branch === site.productionBranch
                  ? [siteDrafts.siteId, siteDrafts.path]
                  : [siteDrafts.siteId, siteDrafts.branch, siteDrafts.path],
              set: {
                ...values,
                branch,
                revision: sql`${siteDrafts.revision} + 1`,
                updatedAt: new Date(),
              },
              setWhere: eq(siteDrafts.revision, siteDrafts.committedRevision),
            })
            .returning()
        : await tx
            .update(siteDrafts)
            .set({
              ...values,
              baseBlobSha: rebase ? input.baseBlobSha : siteDrafts.baseBlobSha,
              baseCommitSha: rebase
                ? input.baseCommitSha
                : siteDrafts.baseCommitSha,
              revision: sql`${siteDrafts.revision} + 1`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(siteDrafts.siteId, site.id),
                eq(siteDrafts.branch, input.branch ?? site.productionBranch),
                eq(siteDrafts.path, input.path),
                eq(siteDrafts.id, input.draftId),
                eq(siteDrafts.revision, input.draftRevision ?? -1)
              )
            )
            .returning();
    if (!draft && observed) {
      const access = await readAccess(site);
      const head = await getBranchHead(access.repository, access.token, branch);
      const published = await readSiteSourceFile(
        site,
        input.path,
        head.sha,
        access
      );
      if (
        head.sha !== observed.baseCommitSha &&
        (observed.deleted
          ? published === null
          : published?.content === observed.content)
      ) {
        [draft] = await tx
          .insert(siteDrafts)
          .values({
            id: observed.id,
            siteId: site.id,
            branch,
            path: input.path,
            ...values,
            revision: observed.revision + 1,
            baseBlobSha: published?.sha ?? null,
            baseCommitSha: head.sha,
          })
          .onConflictDoNothing()
          .returning();
      }
    }
    if (!draft) {
      throw new SitePublishConflictError(
        [input.path],
        "This draft changed in another editor. Reload it before saving."
      );
    }
    return draft;
  });
}

export async function rebaseSiteDraft(
  site: Site,
  input: SiteDraftMutationInput,
  userId: string
): Promise<SiteDraft | null> {
  assertSiteEditableBranch(site, input.branch ?? site.productionBranch);
  const siteDrafts = siteDraftTable(
    input.branch ?? site.productionBranch,
    site.productionBranch
  );
  const { path } = input;
  const [draft] = await db
    .select()
    .from(siteDrafts)
    .where(
      and(
        eq(siteDrafts.siteId, site.id),
        eq(siteDrafts.branch, input.branch ?? site.productionBranch),
        eq(siteDrafts.path, path)
      )
    )
    .limit(1);
  if (!draft) {
    if (input.draftId !== null) {
      throw new SitePublishConflictError(
        [path],
        "This draft was removed in another editor. Reload it before rebasing."
      );
    }
    return null;
  }
  const current = await readSiteSourceFile(
    site,
    path,
    input.branch ?? site.productionBranch
  );
  return await saveSiteDraft(
    site,
    {
      ...input,
      content: draft.content,
      deleted: draft.deleted,
      baseBlobSha: current?.sha ?? null,
      baseCommitSha: draft.baseCommitSha,
      userId,
    },
    true
  );
}

export async function discardSiteDraft(
  site: Site,
  input: SiteDraftMutationInput
): Promise<void> {
  const branch = input.branch ?? site.productionBranch;
  assertSiteEditableBranch(site, branch);
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  await db.transaction(async (tx) => {
    await lockSiteBranchEdits(tx, site.id, branch, true);
    await lockSourceContext(tx, site.id, input, "discarding");
    if (input.draftId === null || input.draftRevision === null) {
      const [existing] = await tx
        .select()
        .from(siteDrafts)
        .where(
          and(
            eq(siteDrafts.siteId, site.id),
            eq(siteDrafts.branch, input.branch ?? site.productionBranch),
            eq(siteDrafts.path, input.path)
          )
        )
        .limit(1);
      if (existing) {
        throw new SitePublishConflictError(
          [input.path],
          "This draft changed in another editor. Reload it before discarding."
        );
      }
      return;
    }
    const removed = await tx
      .delete(siteDrafts)
      .where(
        and(
          eq(siteDrafts.siteId, site.id),
          eq(siteDrafts.branch, input.branch ?? site.productionBranch),
          eq(siteDrafts.path, input.path),
          eq(siteDrafts.id, input.draftId),
          eq(siteDrafts.revision, input.draftRevision)
        )
      )
      .returning({ id: siteDrafts.id });
    if (removed.length === 0) {
      const [remaining] = await tx
        .select({ id: siteDrafts.id })
        .from(siteDrafts)
        .where(
          and(
            eq(siteDrafts.siteId, site.id),
            eq(siteDrafts.branch, branch),
            eq(siteDrafts.path, input.path)
          )
        )
        .limit(1);
      if (!remaining) {
        return;
      }
      throw new SitePublishConflictError(
        [input.path],
        "This draft changed in another editor. Reload it before discarding."
      );
    }
  });
}

async function validateWithDrafts(
  site: Site,
  drafts: SiteDraft[],
  branch = site.productionBranch,
  providedAccess?: SiteRepositoryAccess,
  source?: SiteSourceListing
) {
  const access = providedAccess ?? (await readAccess(site));
  const { files: tree, commitSha } =
    source ?? (await listSiteSourceFiles(site, branch, access));
  const files = new Map<string, string | null>();
  for (const entry of tree) {
    files.set(entry.path, null);
  }
  const draftPaths = new Set(drafts.map((draft) => draft.path));
  const ignoreDraft = drafts.find(
    (draft) => draft.path === SITE_IGNORE_FILENAME
  );
  if (ignoreDraft) {
    if (ignoreDraft.deleted) {
      files.delete(SITE_IGNORE_FILENAME);
    } else {
      files.set(SITE_IGNORE_FILENAME, ignoreDraft.content);
    }
  } else if (files.has(SITE_IGNORE_FILENAME)) {
    const ignoreFile = await readSiteSourceFile(
      site,
      SITE_IGNORE_FILENAME,
      commitSha,
      access
    );
    files.set(SITE_IGNORE_FILENAME, ignoreFile?.content ?? null);
  }
  const isIgnored = createSiteIgnore(files.get(SITE_IGNORE_FILENAME) ?? "");
  const needsContent = tree.filter(
    (entry) =>
      (VALIDATED_SOURCE_FILE.test(entry.path) ||
        entry.path === SITE_CONFIG_FILENAME) &&
      !draftPaths.has(entry.path) &&
      !isIgnored(entry.path)
  );
  const contents = await mapWithConcurrency(
    needsContent,
    SITE_EDITOR_READ_CONCURRENCY,
    (entry) => readSiteSourceFile(site, entry.path, commitSha, access)
  );
  for (const [index, entry] of needsContent.entries()) {
    files.set(entry.path, contents[index]?.content ?? null);
  }
  for (const draft of drafts) {
    if (draft.deleted) {
      files.delete(draft.path);
    } else {
      files.set(draft.path, draft.content);
    }
  }
  return validateSite({
    files,
    defaultConfig: createDefaultSiteConfig(site.name),
  });
}

export async function validateSiteDrafts(
  site: Site,
  branch = site.productionBranch,
  commitSha?: string
) {
  const access = commitSha ? await readAccess(site) : undefined;
  const source = commitSha
    ? await listSiteSourceFiles(site, branch, access, commitSha)
    : undefined;
  return await validateWithDrafts(
    site,
    await listSiteDrafts(site.id, branch),
    branch,
    access,
    source
  );
}

export async function publishSiteDrafts(
  site: Site,
  input: PublishSiteDraftsInput
): Promise<PublishSiteDraftsResult> {
  const branch = input.branch ?? site.productionBranch;
  if (branch !== site.productionBranch) {
    throw new SiteInputError("Feature branches save automatically");
  }
  return await flushSiteDrafts(site, { ...input, branch });
}

export async function flushSiteDrafts(
  site: Site,
  input: PublishSiteDraftsInput
): Promise<PublishSiteDraftsResult> {
  const branch = input.branch ?? site.productionBranch;
  assertSiteEditableBranch(site, branch);
  const siteDrafts = siteDraftTable(branch, site.productionBranch);
  const access = await siteRepositoryAccess(site, {
    contents: "write",
    pull_requests: "write",
  });
  return await withSiteBranchLock(
    site.id,
    branch,
    async (tx) => {
      const [currentSite] = await tx
        .select()
        .from(sites)
        .where(eq(sites.id, site.id));
      if (
        !currentSite ||
        currentSite.productionBranch !== site.productionBranch ||
        currentSite.rootDirectory !== site.rootDirectory
      ) {
        throw new SitePublishConflictError(
          [],
          "The site's source changed. Reload the editor."
        );
      }
      const production = branch === site.productionBranch;
      const { repository, token } = access;
      const head = await getBranchHead(repository, token, branch);
      if (await requiresPullRequest(repository, token, branch)) {
        throw new SiteInputError(
          `${branch} requires a new branch before editing can be published.`
        );
      }
      const drafts = await listSiteDrafts(site.id, branch, tx);
      if (drafts.length === 0) {
        return { commitSha: head.sha, pullRequestUrl: null };
      }
      const source = await listSiteSourceFiles(site, branch, access);
      if (production) {
        const validation = await validateWithDrafts(
          site,
          drafts,
          branch,
          access,
          source
        );
        if (!validation.ok) {
          const first = validation.diagnostics.find(
            (diagnostic) => diagnostic.severity === "error"
          );
          throw new SiteInputError(
            `Fix the errors first: ${first?.file ?? "site"}: ${first?.message ?? "invalid site"}`
          );
        }
      }
      const { commitSha: headSha, files } = source;
      const current = new Map(files.map((file) => [file.path, file.sha]));
      const conflicts: string[] = [];
      const pending: SiteDraft[] = [];
      for (const draft of drafts) {
        if ((current.get(draft.path) ?? null) === draft.baseBlobSha) {
          pending.push(draft);
          continue;
        }
        const file = await readSiteSourceFile(
          site,
          draft.path,
          headSha,
          access
        );
        // A previous attempt may have committed successfully before opening its PR failed.
        if (draft.deleted ? file !== null : file?.content !== draft.content) {
          conflicts.push(draft.path);
        }
      }
      if (conflicts.length > 0) {
        throw new SitePublishConflictError(
          conflicts,
          `Changed on GitHub since you started editing: ${conflicts.join(", ")}. Reload them and re-apply your edits.`
        );
      }
      const headline =
        input.message.trim().slice(0, MAX_PUBLISH_HEADLINE_LENGTH) ||
        DEFAULT_PUBLISH_HEADLINE;
      let commitSha = headSha;
      if (pending.length > 0) {
        try {
          commitSha = await commitRepositoryFiles(repository, token, {
            branch,
            headline,
            expectedHeadOid: headSha,
            additions: pending
              .filter((draft) => !draft.deleted)
              .map((draft) => ({
                path: repositoryPath(site.rootDirectory, draft.path),
                content: draft.content,
              })),
            deletions: pending
              .filter((draft) => draft.deleted)
              .map((draft) => repositoryPath(site.rootDirectory, draft.path)),
          });
        } catch (error) {
          if (STALE_HEAD_ERROR_PATTERN.test(errorMessage(error))) {
            throw new SitePublishConflictError(
              [],
              `${branch} moved while publishing. Try again.`
            );
          }
          throw error;
        }
      }
      let pullRequestUrl: string | null = null;
      if (!production) {
        const existing = await branchPullRequest(
          repository,
          token,
          branch,
          site.productionBranch
        );
        pullRequestUrl =
          existing?.state === "OPEN"
            ? existing.url
            : await openRepositoryPullRequest(repository, token, {
                title: headline,
                head: branch,
                base: site.productionBranch,
                body: "Edited in Notra.",
                draft: true,
              });
      }
      const committed =
        commitSha === headSha
          ? source
          : await listSiteSourceFiles(site, branch, access, commitSha);
      const blobs = new Map(
        committed.files.map((file) => [file.path, file.sha])
      );
      for (const draft of drafts) {
        if (production) {
          await tx
            .delete(siteDrafts)
            .where(
              and(
                eq(siteDrafts.id, draft.id),
                eq(siteDrafts.revision, draft.revision)
              )
            );
        }
        await tx
          .update(siteDrafts)
          .set({
            baseBlobSha: blobs.get(draft.path) ?? null,
            baseCommitSha: commitSha,
            committedRevision: draft.revision,
          })
          .where(
            and(
              eq(siteDrafts.id, draft.id),
              sql`${siteDrafts.baseBlobSha} is not distinct from ${draft.baseBlobSha}`
            )
          );
      }
      return { commitSha, pullRequestUrl };
    },
    false,
    input.skipIfBusy
      ? async () => ({
          commitSha: (
            await getBranchHead(access.repository, access.token, branch)
          ).sha,
          pullRequestUrl: null,
        })
      : undefined
  );
}
