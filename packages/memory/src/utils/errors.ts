export class MemoryConflictError extends Error {
  override name = "MemoryConflictError";
}

export class MemoryAccessError extends Error {
  override name = "MemoryAccessError";
}

export class MemoryLimitError extends Error {
  override name = "MemoryLimitError";
}

export class MemoryNotConfiguredError extends Error {
  override name = "MemoryNotConfiguredError";
}

/** The branch moved since the writer read it; nothing was saved. */
export class RepoConflictError extends Error {
  override name = "RepoConflictError";
}
