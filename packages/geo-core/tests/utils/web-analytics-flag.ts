import { mock } from "bun:test";

import type { WebAnalyticsFlagState } from "@notra/ai/types/web-analytics-access";
import { Effect } from "effect";

/** The organization's web analytics flag as the flag service would answer it. */
export const webAnalyticsFlag: { state: WebAnalyticsFlagState } = {
  state: "enabled",
};

export const resolveWebAnalyticsFlagState = mock(
  async (_organizationId: string) => webAnalyticsFlag.state
);

mock.module("@notra/ai/utils/web-analytics-access", () => ({
  resolveWebAnalyticsFlagState,
  webAnalyticsFlagState: (organizationId: string) =>
    Effect.promise(() => resolveWebAnalyticsFlagState(organizationId)),
  isWebAnalyticsEnabledForOrganization: async (organizationId: string) =>
    (await resolveWebAnalyticsFlagState(organizationId)) === "enabled",
}));
