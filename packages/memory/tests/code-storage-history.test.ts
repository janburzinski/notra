import { expect, test } from "bun:test";

import { RefUpdateError } from "@pierre/storage";
import type { GitStorage } from "@pierre/storage";

import { openMemorySnapshot, updateMemory } from "../src/memory";
import {
  createCodeStorageStore,
  memoryRepoId,
} from "../src/stores/code-storage";
import { createInMemoryStore } from "../src/stores/in-memory";
import type { MemoryCompactOptions, MemoryStore } from "../src/types/memory";
import { MemoryConflictError } from "../src/utils/errors";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-01-01T00:00:00Z").getTime();

interface FakeCommit {
  sha: string;
  message: string;
  date: Date;
  files: Map<string, string>;
}

/** The slice of code.storage the memory store uses, kept in maps. */
function fakeStorage() {
  const repos = new Map<string, { createdAt: Date; commits: FakeCommit[] }>();
  let shas = 0;
  const state = {
    now: T0,
    repos,
    beforeCreate: null as ((id: string) => Promise<void>) | null,
    beforeDelete: null as ((id: string) => Promise<void>) | null,
    failCommit: null as ((id: string, message: string) => Error | null) | null,
    failHead: null as ((id: string) => Error | null) | null,
    stall: null as ((id: string) => boolean) | null,
  };
  const existing = (id: string) => {
    const repo = repos.get(id);
    if (!repo) {
      throw new Error("Repository not found");
    }
    return repo;
  };
  const at = (id: string, ref: string) =>
    existing(id).commits.find((commit) => commit.sha === ref);

  const repoHandle = (id: string) => ({
    listCommits: async ({ limit }: { limit: number }) => {
      if (state.stall?.(id)) {
        await new Promise(() => undefined);
      }
      const failure = state.failHead?.(id);
      if (failure) {
        throw failure;
      }
      return {
        commits: existing(id).commits.toReversed().slice(0, limit),
        hasMore: false,
      };
    },
    listFiles: async ({ ref }: { ref: string }) => ({
      paths: [...(at(id, ref)?.files.keys() ?? [])],
      hasMore: false,
    }),
    getFileStream: async ({ path, ref }: { path: string; ref: string }) => {
      const content = at(id, ref)?.files.get(path);
      return content === undefined
        ? new Response(null, { status: 404 })
        : new Response(content);
    },
    createCommit: (options: {
      commitMessage: string;
      expectedHeadSha?: string;
    }) => {
      const changes = new Map<string, string | null>();
      const builder = {
        addFileFromString(path: string, content: string) {
          changes.set(path, content);
          return builder;
        },
        deletePath(path: string) {
          changes.set(path, null);
          return builder;
        },
        send: async () => {
          const repo = existing(id);
          const failure = state.failCommit?.(id, options.commitMessage);
          if (failure) {
            throw failure;
          }
          const head = repo.commits.at(-1);
          if (
            options.expectedHeadSha !== undefined &&
            options.expectedHeadSha !== head?.sha
          ) {
            throw new RefUpdateError("Head moved", {
              status: "precondition_failed",
              reason: "precondition_failed",
            });
          }
          const files = new Map(head?.files);
          for (const [path, content] of changes) {
            if (content === null) {
              files.delete(path);
            } else {
              files.set(path, content);
            }
          }
          shas += 1;
          const sha = `sha-${shas}`;
          repo.commits.push({
            sha,
            message: options.commitMessage,
            date: new Date(state.now),
            files,
          });
          return { commitSha: sha };
        },
      };
      return builder;
    },
  });

  const storage = {
    repo: ({ id }: { id: string }) => repoHandle(id),
    createRepo: async ({ id }: { id: string }) => {
      await state.beforeCreate?.(id);
      if (repos.has(id)) {
        throw new Error("Repository already exists");
      }
      repos.set(id, { createdAt: new Date(state.now), commits: [] });
      return repoHandle(id);
    },
    deleteRepo: async ({ id }: { id: string }) => {
      await state.beforeDelete?.(id);
      existing(id);
      repos.delete(id);
      return {};
    },
    listRepos: async ({ q }: { q: string }) => ({
      repos: [...repos]
        .filter(([id]) => id.includes(q))
        .map(([id, repo]) => ({
          repoId: id,
          url: id,
          defaultBranch: "main",
          createdAt: repo.createdAt.toISOString(),
        })),
      hasMore: false,
    }),
  };
  return { state, storage: storage as unknown as GitStorage };
}

function setup() {
  const fake = fakeStorage();
  const store = () =>
    createCodeStorageStore({ name: "test", key: "", storage: fake.storage });
  return { ...fake, store, base: memoryRepoId("org") };
}

const options = (now: number): MemoryCompactOptions => ({
  now: new Date(now),
  signal: new AbortController().signal,
  maxAgeMs: 7 * DAY,
  graceMs: HOUR,
  limit: 20,
});

const write = (store: MemoryStore, organizationId: string, text: string) =>
  updateMemory({
    organizationId,
    actor: "user",
    message: "Record feedback",
    mutate: async () => ({ "feedback.md": text }),
    store,
  });

async function feedback(store: MemoryStore) {
  return (await openMemorySnapshot("org", store)).read("feedback.md");
}

const failHandover = (_id: string, message: string) =>
  message.startsWith("Memory moved to ") ? new Error("socket hang up") : null;

test("a move keeps the current files, drops the history and old readers follow it", async () => {
  const { state, store, base } = setup();
  const memory = store();
  await write(memory, "org", "secret retracted note");
  await write(memory, "org", "kept note");
  const before = await openMemorySnapshot("org", memory);
  expect(await memory.compactHistory(options(T0 + 6 * DAY))).toMatchObject({
    compacted: 0,
  });

  state.now = T0 + 8 * DAY;
  expect(await store().compactHistory(options(state.now))).toMatchObject({
    compacted: 1,
  });
  // Once this instance follows the move, a snapshot from before still
  // reads its own version, and a write based on it can't land.
  expect(await memory.head("org")).not.toBe(before.sha);
  expect(await before.read("feedback.md")).toBe("kept note");
  await expect(
    memory.commit("org", {
      expectedHeadSha: before.sha,
      message: "Record feedback",
      files: { "feedback.md": "lost" },
    })
  ).rejects.toBeInstanceOf(MemoryConflictError);
  await write(memory, "org", "after the move");

  // The old generation stays through the grace period, then goes.
  expect(
    await memory.compactHistory(options(state.now + HOUR / 2))
  ).toMatchObject({ deleted: 0 });
  expect(
    await memory.compactHistory(options(state.now + 2 * HOUR))
  ).toMatchObject({ compacted: 0, deleted: 1 });
  expect([...state.repos.keys()]).toEqual([`${base}.g1`]);
  const left = [...state.repos.values()].flatMap((repo) =>
    repo.commits.flatMap((commit) => [...commit.files.values()])
  );
  expect(left.join()).not.toContain("secret retracted note");
  expect(await feedback(store())).toBe("after the move");
});

test("a write that lands during a move cancels it", async () => {
  const { state, store, base } = setup();
  const memory = store();
  await write(memory, "org", "first");
  const writer = store();
  await writer.head("org");
  state.beforeCreate = async () => {
    state.beforeCreate = null;
    await write(writer, "org", "written meanwhile");
  };
  state.now = T0 + 8 * DAY;
  expect(await memory.compactHistory(options(state.now))).toEqual({
    compacted: 0,
    deleted: 0,
    failed: 0,
  });
  expect([...state.repos.keys()]).toEqual([base]);
  expect(await feedback(store())).toBe("written meanwhile");
});

test("the copy of a failed handover goes after the grace period, never the live memory", async () => {
  const { state, store, base } = setup();
  const memory = store();
  await write(memory, "org", "note");
  state.failCommit = failHandover;
  state.now = T0 + 8 * DAY;
  expect(await memory.compactHistory(options(state.now))).toMatchObject({
    failed: 1,
  });
  // The handover might have landed, so the copy stays, and no second move
  // starts beside it.
  state.failCommit = null;
  expect(await memory.compactHistory(options(state.now))).toEqual({
    compacted: 0,
    deleted: 0,
    failed: 0,
  });
  // An unreadable head never makes the live generation look stale.
  state.failHead = (id) => (id === base ? new Error("timeout") : null);
  expect(
    await memory.compactHistory(options(state.now + 2 * HOUR))
  ).toMatchObject({ deleted: 0, failed: 1 });
  state.failHead = null;
  expect(
    await memory.compactHistory(options(state.now + 2 * HOUR))
  ).toMatchObject({ deleted: 1, compacted: 1 });
  // The next move doesn't reuse the copy's name.
  expect([...state.repos.keys()]).toEqual([base, `${base}.g2`]);
  expect(await feedback(store())).toBe("note");
});

test("a copy whose handover lands while the sweep looks is kept", async () => {
  const { state, store, base } = setup();
  const memory = store();
  await write(memory, "org", "note");
  state.failCommit = failHandover;
  state.now = T0 + 8 * DAY;
  await memory.compactHistory(options(state.now));
  state.failCommit = null;
  state.failHead = (id) => {
    if (id === `${base}.g1`) {
      state.failHead = null;
      const old = state.repos.get(base);
      old?.commits.push({
        sha: "sha-moved",
        message: `Memory moved to ${base}.g1`,
        date: new Date(state.now),
        files: new Map(),
      });
    }
    return null;
  };
  await memory.compactHistory(options(state.now + 2 * HOUR));
  expect(await feedback(store())).toBe("note");
});

test("deleting a workspace removes every generation, even one a move adds meanwhile", async () => {
  const { state, store } = setup();
  const memory = store();
  await write(memory, "org", "note");
  await write(memory, "other", "theirs");
  state.now = T0 + 8 * DAY;
  state.beforeDelete = async () => {
    state.beforeDelete = null;
    await store().compactHistory(options(state.now));
  };
  await memory.deleteRepo("org");
  expect([...state.repos.keys()]).toEqual([
    memoryRepoId("other"),
    `${memoryRepoId("other")}.g1`,
  ]);
});

test("a sweep skips young workspaces and stops at the deadline", async () => {
  const { state, store } = setup();
  const memory = store();
  state.now = T0 + 6 * DAY;
  await write(memory, "young", "young");
  state.now = T0;
  await write(memory, "org", "old");
  state.now = T0 + 8 * DAY;
  expect(
    await memory.compactHistory({ ...options(state.now), limit: 1 })
  ).toMatchObject({ compacted: 1 });

  const deadline = new AbortController();
  state.stall = () => {
    deadline.abort(new DOMException("Synthetic deadline", "TimeoutError"));
    return true;
  };
  expect(
    await memory.compactHistory({
      ...options(state.now + 8 * DAY),
      signal: deadline.signal,
    })
  ).toEqual({ compacted: 0, deleted: 0, failed: 0 });
});

test("the in-memory store keeps writing after compaction", async () => {
  const memory = createInMemoryStore();
  for (const text of ["one", "two", "three"]) {
    await write(memory, "org", text);
  }
  await memory.compactHistory(options(Date.now() + 8 * DAY));
  expect(memory.commits("org")).toHaveLength(1);
  await write(memory, "org", "four");
  await write(memory, "org", "five");
  expect(await feedback(memory)).toBe("five");
});
