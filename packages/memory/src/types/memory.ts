/**
 * Who writes. Autonomous runs may only touch their own notes; rules and
 * feedback change only when a person explicitly asks. The dream tidies
 * Autopilot's notes, dedupes rules and keeps conventions and daily notes.
 */
export type MemoryActor =
  | "autopilot-run"
  | "autopilot-dream"
  | "user"
  | "knowledge";

export interface MemoryCommitInput {
  expectedHeadSha: string | null;
  message: string;
  /** null deletes the path. */
  files: Record<string, string | null>;
  author?: { name: string; email: string };
}

export interface MemoryCommitInfo {
  sha: string;
  message: string;
  authorName: string;
  date: string;
}

/** The storage seam: code.storage in production, a map in tests and evals. */
export interface MemoryStore {
  /** null when the workspace has no memory yet. */
  head(organizationId: string): Promise<string | null>;
  read(
    organizationId: string,
    path: string,
    ref: string
  ): Promise<string | null>;
  list(organizationId: string, ref: string): Promise<string[]>;
  /** Throws MemoryConflictError when the head moved since expectedHeadSha. */
  commit(organizationId: string, input: MemoryCommitInput): Promise<string>;
  /** Idempotent; rejects with the signal's reason once it aborts. */
  deleteRepo(organizationId: string, signal?: AbortSignal): Promise<void>;
  /**
   * Drops the history of every workspace memory older than `maxAgeMs`,
   * keeping its current files, and deletes generations it replaced.
   */
  compactHistory(options: MemoryCompactOptions): Promise<MemoryCompactResult>;
}

export interface MemoryCompactOptions {
  now: Date;
  signal: AbortSignal;
  maxAgeMs: number;
  graceMs: number;
  limit: number;
  /** A workspace that failed; the next sweep tries it again. */
  onError?: (repo: string, error: unknown) => void;
}

export interface MemoryCompactResult {
  /** Workspaces whose history was dropped. */
  compacted: number;
  /** Replaced generations deleted. */
  deleted: number;
  failed: number;
}

/** Reads pinned to one commit, so a run never mixes two versions. */
export interface MemorySnapshot {
  readonly sha: string | null;
  read(path: string): Promise<string | null>;
  list(): Promise<string[]>;
}

export type MemoryChanges = Record<string, string | null>;

export interface MemoryUpdateResult {
  sha: string | null;
  changed: boolean;
  /** Preloaded files over the soft limit; the next writer should compact them. */
  overSoftLimit: string[];
}

export interface InMemoryCommit extends MemoryCommitInfo {
  files: Map<string, string>;
}
