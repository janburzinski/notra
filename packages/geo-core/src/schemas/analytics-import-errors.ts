/* oxlint-disable unicorn/throw-new-error -- Schema.TaggedError is a curried class factory, not a constructor. */
import { Schema } from "effect";

/**
 * The provider asked us to slow down, or (`budget`) Notra's own request
 * budget for the connection is used up; retry the same chunk later.
 */
export class ImportRateLimitedError extends Schema.TaggedError<ImportRateLimitedError>()(
  "ImportRateLimitedError",
  {
    provider: Schema.String,
    retryAfterSeconds: Schema.Number,
    budget: Schema.optional(Schema.Boolean),
  }
) {}

/**
 * The stored credentials were rejected; the user must reconnect. `detail` is
 * the provider's reason when it gives one (a deleted or expired token, no
 * access to the team).
 */
export class ImportAuthError extends Schema.TaggedError<ImportAuthError>()(
  "ImportAuthError",
  {
    provider: Schema.String,
    status: Schema.optional(Schema.Number),
    detail: Schema.optional(Schema.String),
  }
) {}

/** The provider answered with something we cannot import. */
export class ImportProviderError extends Schema.TaggedError<ImportProviderError>()(
  "ImportProviderError",
  {
    provider: Schema.String,
    status: Schema.optional(Schema.Number),
    detail: Schema.String,
  }
) {}

/** An uploaded export is not in the expected format. `file` is empty for the ZIP as a whole. */
export class ImportFileError extends Schema.TaggedError<ImportFileError>()(
  "ImportFileError",
  { file: Schema.String, detail: Schema.String }
) {}
