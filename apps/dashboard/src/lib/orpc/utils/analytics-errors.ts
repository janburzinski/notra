import type { AnalyticsRouterError } from "@/lib/analytics/errors";
import { toUnexpectedError } from "@/lib/orpc/effect";
import { notFound } from "@/lib/orpc/utils/errors";

export async function toAnalyticsOrpcError(
  failure: AnalyticsRouterError
): Promise<Error> {
  switch (failure._tag) {
    case "TrackedAccountNotFoundError":
      return notFound("Tracked account not found");
    default:
      return toUnexpectedError(failure.cause, `[Analytics] ${failure.label}`);
  }
}
