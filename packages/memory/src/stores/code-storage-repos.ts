import { GitStorage, RefUpdateError } from "@pierre/storage";
import type { Repo } from "@pierre/storage";

import { REPO_BRANCH } from "../constants/memory";
import type { RepoCommitInput, RepoStore } from "../types/repos";
import { deleteRepoBefore, isRepoNotFound } from "../utils/code-storage";
import { RepoConflictError } from "../utils/errors";

async function send(
  repo: Repo,
  input: RepoCommitInput,
  expectedHeadSha?: string
) {
  let builder = repo.createCommit({
    targetBranch: REPO_BRANCH,
    commitMessage: input.message,
    author: input.author,
    ...(expectedHeadSha ? { expectedHeadSha } : {}),
  });
  for (const [path, content] of Object.entries(input.files)) {
    builder =
      content === null
        ? builder.deletePath(path)
        : builder.addFileFromString(path, content);
  }
  try {
    return (await builder.send()).commitSha;
  } catch (error) {
    if (error instanceof RefUpdateError) {
      throw new RepoConflictError(error.message);
    }
    throw error;
  }
}

/** Repositories on code.storage; handles need no lookup, every id is known. */
export function createCodeStorageRepos(options: {
  name: string;
  key: string;
}): RepoStore {
  const storage = new GitStorage({ name: options.name, key: options.key });
  const repo = (id: string) => storage.repo({ id, defaultBranch: REPO_BRANCH });

  return {
    async create(repoId, input) {
      await storage.createRepo({ id: repoId, defaultBranch: REPO_BRANCH });
      return send(repo(repoId), input);
    },
    commit: (repoId, input) => send(repo(repoId), input, input.expectedHeadSha),
    async read(repoId, path, ref) {
      try {
        const response = await repo(repoId).getFileStream({ path, ref });
        if (response.ok) {
          return await response.text();
        }
        // Only a confirmed missing file reads as missing; any other failure
        // must not look like an empty artifact.
        if (response.status === 404) {
          return null;
        }
        throw new Error(
          `code.storage read of ${repoId}/${path} failed with status ${response.status}`
        );
      } catch (error) {
        if (isRepoNotFound(error)) {
          return null;
        }
        throw error;
      }
    },
    async head(repoId) {
      try {
        const { commits } = await repo(repoId).listCommits({
          branch: REPO_BRANCH,
          limit: 1,
        });
        return commits[0]?.sha ?? null;
      } catch (error) {
        if (isRepoNotFound(error)) {
          return null;
        }
        throw error;
      }
    },
    async deleteRepo(repoId, signal) {
      signal?.throwIfAborted();
      await deleteRepoBefore(storage.deleteRepo({ id: repoId }), signal);
    },
  };
}
