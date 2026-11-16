import { createHash } from "node:crypto";

import { GitStorage, RefUpdateError } from "@pierre/storage";
import type { Repo } from "@pierre/storage";

import {
  MEMORY_AUTHOR,
  MEMORY_BRANCH,
  MEMORY_COMPACT_MESSAGE,
  MEMORY_DELETE_PASSES,
  MEMORY_GENERATION_SUFFIX,
  MEMORY_MOVED,
  MEMORY_PINNED_REFS,
  MEMORY_REPO_HASH_LENGTH,
  MEMORY_REPO_PREFIX,
  MEMORY_REPO_UNSAFE_CHARS,
  MEMORY_SEED,
} from "../constants/memory";
import type { MemoryCompactOptions, MemoryStore } from "../types/memory";
import {
  beforeAbort,
  deleteRepoBefore,
  isRepoNotFound,
} from "../utils/code-storage";
import { MemoryConflictError } from "../utils/errors";

/** Ids with unsafe characters get a hash suffix, so "org.a" and "org_a" never share a repo. */
export function memoryRepoId(organizationId: string) {
  const safe = organizationId.replace(MEMORY_REPO_UNSAFE_CHARS, "_");
  if (safe === organizationId) {
    return `${MEMORY_REPO_PREFIX}${safe}`;
  }
  const hash = createHash("sha256").update(organizationId).digest("hex");
  return `${MEMORY_REPO_PREFIX}${safe}-${hash.slice(0, MEMORY_REPO_HASH_LENGTH)}`;
}

/** Generation 0 keeps the original name, so existing memory needs no move. */
function memoryGenerationName(base: string, generation: number) {
  return generation === 0 ? base : `${base}.g${generation}`;
}

/** The base repo name and generation of a memory repo, or null for any other repo. */
function parseMemoryGeneration(name: string) {
  if (!name.startsWith(MEMORY_REPO_PREFIX)) {
    return null;
  }
  const match = MEMORY_GENERATION_SUFFIX.exec(name);
  return match
    ? { base: name.slice(0, match.index), generation: Number(match[1]) }
    : { base: name, generation: 0 };
}

interface Generation {
  name: string;
  generation: number;
  createdAt: Date;
}

const isMoved = (commit: { message: string } | null) =>
  Boolean(commit?.message.startsWith(MEMORY_MOVED.message));

export function createCodeStorageStore(options: {
  name: string;
  key: string;
  /** Tests pass a fake with the same surface. */
  storage?: GitStorage;
}): MemoryStore {
  const storage =
    options.storage ?? new GitStorage({ name: options.name, key: options.key });
  const handles = new Map<string, Repo>();
  const repoOf = (name: string) =>
    storage.repo({ id: name, defaultBranch: MEMORY_BRANCH });

  // A snapshot keeps reading the generation its commit came from, even after
  // this instance followed a move to the next one.
  const pinned = new Map<string, Repo>();
  function pin(sha: string | null, repo: Repo) {
    if (sha) {
      pinned.delete(sha);
      pinned.set(sha, repo);
      const [oldest] = pinned.keys();
      if (pinned.size > MEMORY_PINNED_REFS && oldest) {
        pinned.delete(oldest);
      }
    }
    return sha;
  }

  /** Every generation of the matching repos, oldest generation first. */
  async function listGenerations(query: string, signal?: AbortSignal) {
    const found = new Map<string, Generation[]>();
    let cursor: string | undefined;
    do {
      const page = await beforeAbort(
        storage.listRepos({ q: query, limit: 100, cursor }),
        signal
      );
      for (const repo of page.repos) {
        const parsed = parseMemoryGeneration(repo.url);
        if (!parsed?.base.startsWith(query)) {
          continue;
        }
        const generations = found.get(parsed.base) ?? [];
        generations.push({
          name: repo.url,
          generation: parsed.generation,
          createdAt: new Date(repo.createdAt),
        });
        found.set(parsed.base, generations);
      }
      cursor = page.hasMore ? page.nextCursor : undefined;
    } while (cursor);
    for (const generations of found.values()) {
      generations.sort((a, b) => a.generation - b.generation);
    }
    return found;
  }

  async function headCommit(repo: Repo, signal?: AbortSignal) {
    const { commits } = await beforeAbort(
      repo.listCommits({ branch: MEMORY_BRANCH, limit: 1 }),
      signal
    );
    return commits[0] ?? null;
  }

  /** The head, or undefined when the repo is gone. */
  async function headIfExists(repo: Repo, signal?: AbortSignal) {
    try {
      return await headCommit(repo, signal);
    } catch (error) {
      if (isRepoNotFound(error)) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * The generation writes go to: the oldest one not yet replaced. A newer
   * one only takes over once the older one's last commit names it, so a
   * write that lands in between makes the move fail instead of getting lost.
   */
  async function resolve(organizationId: string) {
    const base = memoryRepoId(organizationId);
    for (const generation of (await listGenerations(base)).get(base) ?? []) {
      const repo = repoOf(generation.name);
      const head = await headIfExists(repo);
      if (head !== undefined && !isMoved(head)) {
        handles.set(organizationId, repo);
        return repo;
      }
    }
    return null;
  }

  async function findRepo(organizationId: string) {
    return handles.get(organizationId) ?? (await resolve(organizationId));
  }

  /**
   * Runs `use` with the workspace's repo. Another instance may have deleted,
   * recreated or replaced it since the handle was cached, so a missing repo
   * drops the handle and looks it up once more.
   */
  async function withRepo<RESULT>(
    organizationId: string,
    use: (repo: Repo) => Promise<RESULT>,
    missing: () => RESULT | Promise<RESULT>
  ): Promise<RESULT> {
    const cached = handles.has(organizationId);
    const repo = await findRepo(organizationId);
    if (!repo) {
      return missing();
    }
    try {
      return await use(repo);
    } catch (error) {
      if (!(cached && isRepoNotFound(error))) {
        throw error;
      }
      handles.delete(organizationId);
      const fresh = await resolve(organizationId);
      return fresh ? use(fresh) : missing();
    }
  }

  /** The current commit; a replaced generation hands over to its successor. */
  async function currentHead(organizationId: string, repo: Repo) {
    const head = await headCommit(repo);
    if (!isMoved(head)) {
      return pin(head?.sha ?? null, repo);
    }
    handles.delete(organizationId);
    const fresh = await resolve(organizationId);
    return fresh ? pin((await headCommit(fresh))?.sha ?? null, fresh) : null;
  }

  /**
   * code.storage cannot guard a commit on "the branch does not exist yet", so
   * a new repo starts with one commit and every write can name its parent.
   */
  async function createSeededRepo(organizationId: string) {
    try {
      const repo = await storage.createRepo({
        id: memoryRepoId(organizationId),
        defaultBranch: MEMORY_BRANCH,
      });
      handles.set(organizationId, repo);
      const seed = await repo
        .createCommit({
          targetBranch: MEMORY_BRANCH,
          commitMessage: MEMORY_SEED.message,
          author: MEMORY_AUTHOR,
          committer: MEMORY_AUTHOR,
        })
        .addFileFromString(MEMORY_SEED.path, MEMORY_SEED.content)
        .send();
      return { repo, head: seed.commitSha };
    } catch (error) {
      handles.delete(organizationId);
      if (await resolve(organizationId)) {
        throw new MemoryConflictError("Another writer created the memory");
      }
      throw error;
    }
  }

  /** The repo to write to and the head the commit must build on. */
  async function writeTarget(organizationId: string, expected: string | null) {
    const repo = await findRepo(organizationId);
    if (!repo) {
      if (expected) {
        throw new MemoryConflictError(
          "The memory was deleted since it was read"
        );
      }
      return createSeededRepo(organizationId);
    }
    if (expected) {
      return { repo, head: expected };
    }
    // The writer read an empty memory: only an unwritten repo still is.
    const head = await headCommit(repo);
    if (head) {
      if (isMoved(head)) {
        handles.delete(organizationId);
      }
      throw new MemoryConflictError("The memory changed since it was read");
    }
    return { repo, head: null };
  }

  async function readFile(repo: Repo, path: string, ref: string) {
    const response = await repo.getFileStream({ path, ref });
    if (response.ok) {
      return await response.text();
    }
    // Only a confirmed missing file reads as empty: treating any other
    // failure as empty would let the next write drop the file's records.
    if (response.status === 404) {
      return null;
    }
    throw new Error(
      `code.storage read of ${path} failed with status ${response.status}`
    );
  }

  /** Every file of a commit, so its successor starts with exactly them. */
  async function readAll(repo: Repo, ref: string, signal: AbortSignal) {
    const files: Record<string, string> = {};
    let cursor: string | undefined;
    do {
      const page = await beforeAbort(repo.listFiles({ ref, cursor }), signal);
      const contents = await beforeAbort(
        Promise.all(page.paths.map((path) => readFile(repo, path, ref))),
        signal
      );
      for (const [index, path] of page.paths.entries()) {
        const content = contents[index];
        if (content === null || content === undefined) {
          throw new Error(`code.storage lost ${path} while copying memory`);
        }
        files[path] = content;
      }
      cursor = page.hasMore ? page.nextCursor : undefined;
    } while (cursor);
    return files;
  }

  /**
   * Copies the current files into a new generation, then ends the current
   * one with a commit naming it. The handover only lands if nothing was
   * written since the copy was read; otherwise the copy goes and the next
   * sweep tries again.
   */
  async function replace(
    current: Generation,
    nextName: string,
    signal: AbortSignal
  ) {
    const repo = repoOf(current.name);
    const head = await headIfExists(repo, signal);
    if (!head || isMoved(head)) {
      return false;
    }
    const files = await readAll(repo, head.sha, signal);
    const next = await beforeAbort(
      storage.createRepo({ id: nextName, defaultBranch: MEMORY_BRANCH }),
      signal
    );
    let builder = next.createCommit({
      targetBranch: MEMORY_BRANCH,
      commitMessage: MEMORY_COMPACT_MESSAGE,
      author: MEMORY_AUTHOR,
      committer: MEMORY_AUTHOR,
    });
    for (const [path, content] of Object.entries(files)) {
      builder = builder.addFileFromString(path, content);
    }
    await beforeAbort(builder.send(), signal);
    try {
      await beforeAbort(
        repo
          .createCommit({
            targetBranch: MEMORY_BRANCH,
            commitMessage: `${MEMORY_MOVED.message}${nextName}`,
            author: MEMORY_AUTHOR,
            committer: MEMORY_AUTHOR,
            expectedHeadSha: head.sha,
          })
          .addFileFromString(MEMORY_MOVED.path, nextName)
          .send(),
        signal
      );
      return true;
    } catch (error) {
      // A write landed after the copy, or the workspace was deleted: the
      // copy is stale. After any other failure, a deadline included, the
      // handover may still land, so the copy stays and a later sweep reads
      // the outcome from the old generation's head.
      if (error instanceof RefUpdateError || isRepoNotFound(error)) {
        await deleteRepoBefore(storage.deleteRepo({ id: nextName }), signal);
        return false;
      }
      throw error;
    }
  }

  /**
   * One workspace's generations: deletes the ones replaced longer than the
   * grace period ago and copies a failed handover left behind, and replaces
   * the current one once its history is older than the limit. Sweeps must
   * not overlap (the caller holds a lock); new generations never reuse a
   * name, so a sweep that fell behind can only delete what it listed.
   */
  async function compactWorkspace(
    base: string,
    generations: Generation[],
    options: MemoryCompactOptions
  ) {
    const { signal } = options;
    const graceStart = options.now.getTime() - options.graceMs;
    let current: Generation | null = null;
    let remaining = 0;
    let deleted = 0;
    for (const generation of generations) {
      const head = await headIfExists(repoOf(generation.name), signal);
      if (head === undefined) {
        continue;
      }
      remaining += 1;
      const replaced = isMoved(head);
      if (!(replaced || current)) {
        current = generation;
        continue;
      }
      // Replaced since its last commit, or a copy whose handover never
      // landed. A copy only goes while the generation before it still
      // hasn't moved, so a handover that just landed keeps it.
      const since = head?.date ?? generation.createdAt;
      if (
        since.getTime() >= graceStart ||
        (!replaced &&
          current &&
          isMoved(await headCommit(repoOf(current.name), signal)))
      ) {
        continue;
      }
      await deleteRepoBefore(
        storage.deleteRepo({ id: generation.name }),
        signal
      );
      remaining -= 1;
      deleted += 1;
    }
    const newest = generations.at(-1)?.generation ?? 0;
    const compacted =
      remaining === 1 &&
      current !== null &&
      current.createdAt.getTime() < options.now.getTime() - options.maxAgeMs &&
      (await replace(current, memoryGenerationName(base, newest + 1), signal));
    return { deleted, compacted };
  }

  return {
    head: (organizationId) =>
      withRepo(
        organizationId,
        (repo) => currentHead(organizationId, repo),
        () => null
      ),
    read: (organizationId, path, ref) => {
      const repo = pinned.get(ref);
      return (
        repo
          ? readFile(repo, path, ref)
          : withRepo(
              organizationId,
              (found) => readFile(found, path, ref),
              () => null
            )
      ).catch((error: unknown) => {
        if (isRepoNotFound(error)) {
          return null;
        }
        throw error;
      });
    },
    list: async (organizationId, ref) => {
      const listFiles = async (repo: Repo) =>
        (await repo.listFiles({ ref })).paths;
      const repo = pinned.get(ref);
      return repo
        ? listFiles(repo)
        : withRepo(organizationId, listFiles, () => []);
    },
    async commit(organizationId, input) {
      const { repo, head } = await writeTarget(
        organizationId,
        input.expectedHeadSha
      );
      let builder = repo.createCommit({
        targetBranch: MEMORY_BRANCH,
        commitMessage: input.message,
        author: input.author ?? MEMORY_AUTHOR,
        committer: MEMORY_AUTHOR,
        ...(head ? { expectedHeadSha: head } : {}),
      });
      for (const [path, content] of Object.entries(input.files)) {
        builder =
          content === null
            ? builder.deletePath(path)
            : builder.addFileFromString(path, content);
      }
      try {
        const { commitSha } = await builder.send();
        pin(commitSha, repo);
        return commitSha;
      } catch (error) {
        if (error instanceof RefUpdateError) {
          throw new MemoryConflictError(error.message);
        }
        if (isRepoNotFound(error)) {
          handles.delete(organizationId);
          throw new MemoryConflictError(
            "The memory was deleted since it was read"
          );
        }
        throw error;
      }
    },
    async deleteRepo(organizationId, signal) {
      signal?.throwIfAborted();
      handles.delete(organizationId);
      const base = memoryRepoId(organizationId);
      // The base name goes even if the listing lags; a move running
      // meanwhile can add a generation, so the listing is checked again.
      let names = [base];
      for (
        let pass = 0;
        pass < MEMORY_DELETE_PASSES && names.length > 0;
        pass += 1
      ) {
        for (const name of names) {
          await deleteRepoBefore(storage.deleteRepo({ id: name }), signal);
        }
        names = ((await listGenerations(base, signal)).get(base) ?? []).map(
          (generation) => generation.name
        );
      }
    },
    async compactHistory(compactOptions) {
      const result = { compacted: 0, deleted: 0, failed: 0 };
      const workspaces = await listGenerations(
        MEMORY_REPO_PREFIX,
        compactOptions.signal
      );
      const historyCutoff =
        compactOptions.now.getTime() - compactOptions.maxAgeMs;
      let handled = 0;
      for (const [base, generations] of workspaces) {
        // Only workspaces with a replaced generation or old history.
        const due =
          generations.length > 1 ||
          (generations[0]?.createdAt.getTime() ?? Number.POSITIVE_INFINITY) <
            historyCutoff;
        if (!due) {
          continue;
        }
        if (compactOptions.signal.aborted || handled >= compactOptions.limit) {
          break;
        }
        handled += 1;
        try {
          // react-doctor-disable-next-line react-doctor/async-await-in-loop -- workspaces share one deadline and stop when it ends
          const outcome = await compactWorkspace(
            base,
            generations,
            compactOptions
          );
          result.deleted += outcome.deleted;
          result.compacted += outcome.compacted ? 1 : 0;
        } catch (error) {
          // Running out of time is no failure: the next sweep goes on.
          if (!compactOptions.signal.aborted) {
            result.failed += 1;
            compactOptions.onError?.(base, error);
          }
        }
      }
      return result;
    },
  };
}
