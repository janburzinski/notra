import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

import {
  FILE_REPOS_LOCK_STALE_MS,
  FILE_REPOS_LOCK_WAIT_MS,
} from "../constants/memory";
import type { RepoCommitInput, RepoStore } from "../types/repos";
import { RepoConflictError } from "../utils/errors";

interface StoredCommit {
  sha: string;
  files: Record<string, string>;
}

type Repos = Record<string, StoredCommit[]>;

const pause = new Int32Array(new SharedArrayBuffer(4));

/** How long the lock has been held; 0 when its owner just released it. */
function lockAge(lock: string) {
  try {
    return Date.now() - statSync(lock).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Runs `use` while holding `<path>.lock`, so the dashboard and the agent
 * never read the same file and overwrite each other's commits. A lock left
 * by a crashed process is taken over once it is stale.
 */
function locked<RESULT>(path: string, use: () => RESULT): RESULT {
  const lock = `${path}.lock`;
  const deadline = Date.now() + FILE_REPOS_LOCK_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(lock, "wx"));
      break;
    } catch {
      if (lockAge(lock) > FILE_REPOS_LOCK_STALE_MS) {
        try {
          unlinkSync(lock);
        } catch {
          // Another process took it over first.
        }
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${lock}`);
      }
      Atomics.wait(pause, 0, 0, 10);
    }
  }
  try {
    return use();
  } finally {
    try {
      unlinkSync(lock);
    } catch {
      // Already taken over as stale.
    }
  }
}

/**
 * Repositories in one JSON file, for local development without code.storage.
 * It outlives dev server restarts and is shared by every local process, so
 * the rows in the database never point at history that is gone.
 */
export function createFileRepos(path: string): RepoStore {
  const load = (): Repos =>
    existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const save = (repos: Repos) => {
    const temporary = `${path}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(repos));
    renameSync(temporary, path);
  };
  const append = (repos: Repos, repoId: string, input: RepoCommitInput) => {
    const commits = repos[repoId] ?? [];
    const files = { ...commits.at(-1)?.files };
    for (const [file, content] of Object.entries(input.files)) {
      if (content === null) {
        delete files[file];
      } else {
        files[file] = content;
      }
    }
    const sha = createHash("sha1")
      .update(`${repoId}:${commits.length}:${JSON.stringify(files)}`)
      .digest("hex");
    commits.push({ sha, files });
    repos[repoId] = commits;
    save(repos);
    return sha;
  };

  return {
    create: async (repoId, input) =>
      locked(path, () => {
        const repos = load();
        if (repos[repoId]) {
          throw new Error("Repository already exists");
        }
        return append(repos, repoId, input);
      }),
    commit: async (repoId, input) =>
      locked(path, () => {
        const repos = load();
        if (repos[repoId]?.at(-1)?.sha !== input.expectedHeadSha) {
          throw new RepoConflictError("The branch moved since it was read");
        }
        return append(repos, repoId, input);
      }),
    read: async (repoId, file, ref) =>
      load()[repoId]?.find((commit) => commit.sha === ref)?.files[file] ?? null,
    head: async (repoId) => load()[repoId]?.at(-1)?.sha ?? null,
    async deleteRepo(repoId, signal) {
      signal?.throwIfAborted();
      locked(path, () => {
        const repos = load();
        delete repos[repoId];
        save(repos);
      });
    },
  };
}
