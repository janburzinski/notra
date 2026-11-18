import { Data } from "effect";

export class AnalyticsTinybirdError extends Data.TaggedError(
  "AnalyticsTinybirdError"
)<{
  readonly label: string;
  readonly cause: unknown;
}> {}

export class AnalyticsDatabaseError extends Data.TaggedError(
  "AnalyticsDatabaseError"
)<{
  readonly label: string;
  readonly cause: unknown;
}> {}

export class TrackedAccountNotFoundError extends Data.TaggedError(
  "TrackedAccountNotFoundError"
)<{
  readonly trackedAccountId: string;
}> {}

export type AnalyticsRouterError =
  | AnalyticsDatabaseError
  | TrackedAccountNotFoundError;

export class AnalyticsFlagEvaluationError extends Data.TaggedError(
  "AnalyticsFlagEvaluationError"
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}
