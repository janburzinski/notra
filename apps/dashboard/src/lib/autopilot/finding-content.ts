import {
  getPullRequestHead,
  listGitHubPullRequestFiles,
} from "@notra/ai/utils/github-pr-commit";
import { db } from "@notra/db/drizzle";
import { autopilotFindings } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import {
  AUTOPILOT_CONTENT_FILE_PATTERN,
  AUTOPILOT_CONTENT_IMAGE_KEY_PREFIX,
  AUTOPILOT_CONTENT_IMAGE_MAX_BYTES,
  AUTOPILOT_CONTENT_IMAGES_MAX_BYTES,
  AUTOPILOT_CONTENT_MAX_FILES,
  AUTOPILOT_CONTENT_MAX_OTHER_FILES,
  AUTOPILOT_CONTENT_MAX_POSTS,
  AUTOPILOT_CONTENT_PATCH_MAX_CHARS,
} from "@/constants/autopilot-brief";
import { pullRequestRef } from "@/lib/autopilot/findings";
import {
  getRepositoryOctokit,
  readRepositoryFile,
  readRepositoryFileBase64,
} from "@/lib/autopilot/github";
import type {
  AutopilotFindingContent,
  AutopilotFindingPost,
  AutopilotRepository,
} from "@/types/autopilot";
import type { AutopilotOctokit } from "@/types/autopilot-runtime";
import {
  imageMimeType,
  parsePostFile,
  postImageSources,
  replaceImageSources,
  resolvePostImagePath,
} from "@/utils/autopilot-content";

/**
 * Inlines the pull request's own images each post shows as data URLs, so
 * diagrams render in the modal from the same commit, private repositories
 * included. An image that is missing, of another type or over the size
 * limits keeps its source.
 */
async function withPostImages(
  octokit: AutopilotOctokit,
  repository: AutopilotRepository,
  sha: string,
  posts: Omit<AutopilotFindingPost, "images">[],
  imagePaths: string[]
): Promise<AutopilotFindingPost[]> {
  const wanted = posts.map((post) => {
    const sources = new Map<string, string>();
    for (const source of postImageSources(post.body)) {
      const path = resolvePostImagePath(post.path, source, imagePaths);
      if (path) {
        sources.set(source, path);
      }
    }
    return sources;
  });
  const paths = [
    ...new Set(wanted.flatMap((sources) => [...sources.values()])),
  ];
  const files = await Promise.all(
    paths.map((path) =>
      readRepositoryFileBase64(octokit, repository, path, sha)
    )
  );
  const dataUrls = new Map<string, string>();
  let total = 0;
  for (const [index, path] of paths.entries()) {
    const file = files[index];
    const type = imageMimeType(path);
    if (
      file &&
      type &&
      file.size <= AUTOPILOT_CONTENT_IMAGE_MAX_BYTES &&
      total + file.size <= AUTOPILOT_CONTENT_IMAGES_MAX_BYTES
    ) {
      total += file.size;
      dataUrls.set(path, `data:${type};base64,${file.base64}`);
    }
  }
  return posts.map((post, index) => {
    const keys = new Map<string, string>();
    const images: Record<string, string> = {};
    for (const [source, path] of wanted[index] ?? []) {
      const url = dataUrls.get(path);
      if (url) {
        const key = `${AUTOPILOT_CONTENT_IMAGE_KEY_PREFIX}${keys.size}`;
        keys.set(source, key);
        images[key] = url;
      }
    }
    return { ...post, body: replaceImageSources(post.body, keys), images };
  });
}

/**
 * What an item's pull request actually changes, read from GitHub: the posts
 * and pages it writes, rendered from the branch, and the other files as
 * patches. Null when the item has no pull request yet.
 */
export async function loadFindingContent(
  organizationId: string,
  findingId: string
): Promise<AutopilotFindingContent | null> {
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  if (!finding) {
    return null;
  }
  const ref = pullRequestRef(finding);
  if (!ref) {
    return null;
  }
  const octokit = await getRepositoryOctokit(organizationId, {
    owner: ref.owner,
    name: ref.repo,
  });
  const [head, files] = await Promise.all([
    getPullRequestHead({
      octokit,
      owner: ref.owner,
      repo: ref.repo,
      pullNumber: ref.pullNumber,
    }),
    listGitHubPullRequestFiles({
      octokit,
      owner: ref.owner,
      repo: ref.repo,
      pullNumber: ref.pullNumber,
      page: 1,
      perPage: AUTOPILOT_CONTENT_MAX_FILES,
    }),
  ]);
  const live = files.filter((file) => file.status !== "removed");
  const postFiles = live
    .filter((file) => AUTOPILOT_CONTENT_FILE_PATTERN.test(file.path))
    .slice(0, AUTOPILOT_CONTENT_MAX_POSTS);
  const repository = { owner: ref.owner, name: ref.repo, branch: head.headRef };
  // The commit the pull request is on now, so edits made on GitHub show too.
  const reads = await Promise.all(
    postFiles.map(async (file) => ({
      file,
      raw: await readRepositoryFile(
        octokit,
        repository,
        file.path,
        head.headSha
      ),
    }))
  );
  const parsed: Omit<AutopilotFindingPost, "images">[] = [];
  for (const { file, raw } of reads) {
    // A post GitHub would not return stays listed below with its patch.
    if (raw !== null) {
      parsed.push({
        path: file.path,
        status: file.status,
        ...parsePostFile(raw),
      });
    }
  }
  const posts = await withPostImages(
    octokit,
    repository,
    head.headSha,
    parsed,
    live.map((file) => file.path).filter((path) => imageMimeType(path) !== null)
  );
  const postPaths = new Set(posts.map((post) => post.path));
  const otherFiles = files
    .filter((file) => !postPaths.has(file.path))
    .slice(0, AUTOPILOT_CONTENT_MAX_OTHER_FILES);
  return {
    /** The commit this was read at; a request's commit moves it. */
    headSha: head.headSha,
    posts,
    otherFiles: otherFiles.map((file) => ({
      ...file,
      patch: file.patch?.slice(0, AUTOPILOT_CONTENT_PATCH_MAX_CHARS) ?? null,
    })),
    // Counted from the pull request; the list above is only its first page.
    hiddenFiles: Math.max(
      0,
      head.changedFiles - posts.length - otherFiles.length
    ),
  };
}
