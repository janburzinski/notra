import { Schema } from "effect";

export class SocialPublishError extends Schema.TaggedError<SocialPublishError>()(
  "SocialPublishError",
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

/**
 * The create request may have reached X: it timed out, the connection
 * dropped, or PostForMe answered with a server error. Sending it again could
 * post twice, so a person has to check the account first.
 */
export class SocialPublishDeliveryUnknownError extends Schema.TaggedError<SocialPublishDeliveryUnknownError>()(
  "SocialPublishDeliveryUnknownError",
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}
