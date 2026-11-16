/** Every workspace's memory is one repository on code.storage. */
export const MEMORY_REPO_PREFIX = "notra-memory-";
export const MEMORY_BRANCH = "main";

export const MEMORY_AUTHOR = {
  name: "Notra",
  email: "memory@usenotra.com",
} as const;

/** The first commit of every memory repo, so later writes have a parent to check. */
export const MEMORY_SEED = {
  path: "README.md",
  message: "Create workspace memory",
  content:
    "# Notra workspace memory\n\nrules.md and feedback.md are written by people, planner.md by Autopilot, knowledge/ by onboarding.\n",
} as const;

/**
 * Concurrent writers re-read and re-apply their change this many times,
 * waiting a random share of a growing delay so they stop colliding.
 */
export const MEMORY_COMMIT_ATTEMPTS = 8;
export const MEMORY_CONFLICT_BACKOFF_MS = 100;

/**
 * Files every Autopilot run loads into its prompt. Past the soft limit the
 * writer is told to compact; past the hard limit the write is refused.
 */
export const MEMORY_PRELOADED_SOFT_LIMIT_BYTES = 8 * 1024;
export const MEMORY_PRELOADED_HARD_LIMIT_BYTES = 16 * 1024;
/** Files only read on demand (knowledge). */
export const MEMORY_ON_DEMAND_LIMIT_BYTES = 64 * 1024;

export const MEMORY_PATHS = {
  rules: "rules.md",
  feedback: "feedback.md",
  planner: "planner.md",
  knowledge: (slug: string) => `knowledge/${slug}.md`,
  daily: (date: string) => `daily/${date}.md`,
  dreamState: ".dream/state.json",
} as const;

export const MEMORY_DAILY_PATH = /^daily\/(\d{4}-\d{2}-\d{2})\.md$/;
export const MEMORY_SEGMENT_UNSAFE = /[^a-z0-9_.-]+/g;
export const MEMORY_SEGMENT_DOTS = /\.{2,}/g;
export const MEMORY_SEGMENT_EDGE = /^[^a-z0-9]+|[^a-z0-9]+$/g;
export const MEMORY_SEGMENT_HASH_CHARS = 8;

export const MEMORY_PRELOADED_PATTERN = /^(?:rules|feedback|planner)\.md$/;
export const MEMORY_SAFE_PATH =
  /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9_.-]*)*\.md$/;
/** Organization ids become repo names, so anything outside this set is replaced. */
export const MEMORY_REPO_UNSAFE_CHARS = /[^a-zA-Z0-9_-]/g;
export const MEMORY_REPO_HASH_LENGTH = 12;
export const MEMORY_REPO_NOT_FOUND = /^Repository not found$/i;

/**
 * Memory keeps no history past this age: the repo is copied, current files
 * only, into its next generation (`<repo>.g<N>`; sanitized ids never hold a
 * dot) and the old one is deleted, so dropped, retracted and rewritten notes
 * leave code.storage within days, well inside the DPA's 30.
 */
export const MEMORY_HISTORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * How long a replaced generation stays readable, so a run that opened its
 * snapshot before the move can finish on it.
 */
export const MEMORY_GENERATION_GRACE_MS = 60 * 60 * 1000;
/** Workspaces one sweep compacts at most; the next sweep continues. */
export const MEMORY_COMPACT_BATCH = 20;
/** Commits whose repo a store remembers, so snapshots survive a move. */
export const MEMORY_PINNED_REFS = 1000;
/** A move that runs during a deletion adds one generation, so deletion looks again. */
export const MEMORY_DELETE_PASSES = 3;
export const MEMORY_GENERATION_SUFFIX = /\.g(\d+)$/;
/** The last commit of a replaced generation names its successor. */
export const MEMORY_MOVED = {
  path: ".moved",
  message: "Memory moved to ",
} as const;
export const MEMORY_COMPACT_MESSAGE = "Workspace memory";
export const MEMORY_RECORD_META_LINE = /^<!--\s*notra\s+(\{.*\})\s*-->$/;
export const MEMORY_RECORD_SECTION = /^## (.+)$/;

/** Branch of every repository the repo store writes. */
export const REPO_BRANCH = "main";

/** The local file store's lock: how long a writer waits, and when a lock left by a crash is taken over. */
export const FILE_REPOS_LOCK_WAIT_MS = 5000;
export const FILE_REPOS_LOCK_STALE_MS = 10_000;
