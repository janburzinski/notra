// A mistake in the command line: printed without a stack trace.
export class UsageError extends Error {
  readonly name = "UsageError";
}
