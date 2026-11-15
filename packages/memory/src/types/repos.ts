export interface RepoAuthor {
  name: string;
  email: string;
}

export interface RepoCommitInput {
  message: string;
  author: RepoAuthor;
  /** Path to content; null deletes the path. */
  files: Record<string, string | null>;
}

/**
 * One git repository per record on code.storage, so deleting the record is
 * deleting its repository and its whole history with it.
 */
export interface RepoStore {
  /** Creates the repository with its first commit; returns that commit. */
  create(repoId: string, input: RepoCommitInput): Promise<string>;
  /** Throws RepoConflictError when the branch is no longer at expectedHeadSha. */
  commit(
    repoId: string,
    input: RepoCommitInput & { expectedHeadSha: string }
  ): Promise<string>;
  /** null when the file or the repository is missing. */
  read(repoId: string, path: string, ref: string): Promise<string | null>;
  /** null when the repository is missing or has no commit. */
  head(repoId: string): Promise<string | null>;
  /** Idempotent; rejects with the signal's reason once it aborts. */
  deleteRepo(repoId: string, signal?: AbortSignal): Promise<void>;
}
