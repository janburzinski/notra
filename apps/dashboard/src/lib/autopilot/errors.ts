import { Data } from "effect";

export class AutopilotSlackDeliveryError extends Data.TaggedError(
  "AutopilotSlackDeliveryError"
)<{
  readonly message: string;
  readonly code: string;
  readonly organizationId: string;
  readonly cause?: unknown;
}> {}

export class AutopilotEntitlementError extends Data.TaggedError(
  "AutopilotEntitlementError"
)<{
  readonly message: string;
  readonly organizationId: string;
  readonly cause: unknown;
}> {}
