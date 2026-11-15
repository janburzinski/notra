import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCodeStorageRepos } from "./stores/code-storage-repos";
import { createFileRepos } from "./stores/file-repos";
import type { RepoStore } from "./types/repos";
import { codeStorageCredentials } from "./utils/code-storage";
import { MemoryNotConfiguredError } from "./utils/errors";

let configured: RepoStore | null = null;
let override: RepoStore | null = null;

/** The repository store; code.storage unless a test swapped it. */
export function getRepoStore(): RepoStore {
  if (override) {
    return override;
  }
  if (configured) {
    return configured;
  }
  const credentials = codeStorageCredentials();
  if (!credentials && process.env.NODE_ENV === "development") {
    // Local dev without code.storage keeps repositories in a file, so their
    // history survives restarts like the database rows that point at it.
    const path = join(tmpdir(), "notra-artifact-repos.json");
    console.warn(
      `[repos] CODE_STORAGE_NAME or CODE_STORAGE_API_KEY is missing; keeping repositories in ${path} for development`
    );
    configured = createFileRepos(path);
    return configured;
  }
  if (!credentials) {
    throw new MemoryNotConfiguredError(
      "CODE_STORAGE_NAME and CODE_STORAGE_API_KEY are required for artifacts"
    );
  }
  configured = createCodeStorageRepos(credentials);
  return configured;
}

/** Tests run against an in-memory store. null restores code.storage. */
export function setRepoStore(store: RepoStore | null) {
  override = store;
}
