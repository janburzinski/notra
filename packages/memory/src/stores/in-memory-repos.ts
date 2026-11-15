import { createHash } from "node:crypto";

import type { RepoCommitInput, RepoStore } from "../types/repos";
import { RepoConflictError } from "../utils/errors";

interface StoredCommit {
  sha: string;
  message: string;
  author: string;
  files: Map<string, string>;
}

/** Same semantics as code.storage, kept in a map. For tests and local development. */
export function createInMemoryRepos(): RepoStore & {
  commits(repoId: string): readonly StoredCommit[];
  repoIds(): string[];
} {
  const repos = new Map<string, StoredCommit[]>();

  function append(repoId: string, input: RepoCommitInput) {
    const commits = repos.get(repoId) ?? [];
    const files = new Map(commits.at(-1)?.files);
    for (const [path, content] of Object.entries(input.files)) {
      if (content === null) {
        files.delete(path);
      } else {
        files.set(path, content);
      }
    }
    const sha = createHash("sha1")
      .update(`${repoId}:${commits.length}:${input.message}`)
      .digest("hex");
    commits.push({
      sha,
      message: input.message,
      author: input.author.name,
      files,
    });
    repos.set(repoId, commits);
    return sha;
  }

  return {
    async create(repoId, input) {
      if (repos.has(repoId)) {
        throw new Error("Repository already exists");
      }
      return append(repoId, input);
    },
    async commit(repoId, input) {
      if (repos.get(repoId)?.at(-1)?.sha !== input.expectedHeadSha) {
        throw new RepoConflictError("The branch moved since it was read");
      }
      return append(repoId, input);
    },
    read: async (repoId, path, ref) =>
      repos
        .get(repoId)
        ?.find((commit) => commit.sha === ref)
        ?.files.get(path) ?? null,
    head: async (repoId) => repos.get(repoId)?.at(-1)?.sha ?? null,
    async deleteRepo(repoId, signal) {
      signal?.throwIfAborted();
      repos.delete(repoId);
    },
    commits: (repoId) => repos.get(repoId) ?? [],
    repoIds: () => [...repos.keys()],
  };
}
