import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { ConfigProvider, Effect } from "effect";

let enabled = false;
let reason = "TARGETING";
let failing = false;
let hanging = false;
const evaluations: Array<{ key: string; organizationId: string }> = [];

const nodeSdk = await import("@databuddy/sdk/node");
mock.module("@databuddy/sdk/node", () => ({
  ...nodeSdk,
  createServerFlagsManager: () => ({
    getFlag: (key: string, context: { organizationId: string }) => {
      evaluations.push({ key, organizationId: context.organizationId });
      if (hanging) {
        return new Promise(() => {});
      }
      if (failing) {
        return Promise.reject(new Error("Synthetic provider failure"));
      }
      return Promise.resolve({ enabled, reason });
    },
  }),
}));

const {
  isWebAnalyticsEnabledForOrganization,
  resolveWebAnalyticsFlagState,
  webAnalyticsFlagState,
} = await import("./web-analytics-access");

// Config reads the environment once per process, so cases with a different
// environment provide their own.
const flagStateWith = (env: Record<string, string>) =>
  Effect.runPromise(
    webAnalyticsFlagState("org-1").pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
    )
  );

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID:
    process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID,
  NOTRA_DEMO_MODE: process.env.NOTRA_DEMO_MODE,
  WORKOS_API_KEY: process.env.WORKOS_API_KEY,
};

beforeEach(() => {
  enabled = false;
  reason = "TARGETING";
  failing = false;
  hanging = false;
  evaluations.length = 0;
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID = "synthetic-client";
  delete process.env.NOTRA_DEMO_MODE;
  delete process.env.WORKOS_API_KEY;
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("web analytics flag", () => {
  test("asks the flag service for the web-analytics flag of the organization", async () => {
    expect(await isWebAnalyticsEnabledForOrganization("org-off")).toBe(false);
    enabled = true;
    expect(await isWebAnalyticsEnabledForOrganization("org-on")).toBe(true);
    expect(evaluations).toEqual([
      { key: "web-analytics", organizationId: "org-off" },
      { key: "web-analytics", organizationId: "org-on" },
    ]);
  });

  test("reports provider errors and timeouts as unavailable and fails closed", async () => {
    enabled = true;
    reason = "ERROR";
    expect(await resolveWebAnalyticsFlagState("org-1")).toBe("unavailable");
    expect(await isWebAnalyticsEnabledForOrganization("org-1")).toBe(false);
    reason = "TARGETING";
    failing = true;
    expect(await resolveWebAnalyticsFlagState("org-1")).toBe("unavailable");
    hanging = true;
    expect(await resolveWebAnalyticsFlagState("org-1")).toBe("unavailable");
  }, 10_000);

  test("is off in demo mode, even in development, and without a client id", async () => {
    enabled = true;
    process.env.NODE_ENV = "development";
    process.env.NOTRA_DEMO_MODE = "true";
    expect(await resolveWebAnalyticsFlagState("org-1")).toBe("disabled");
    expect(await flagStateWith({ NODE_ENV: "production" })).toBe("disabled");
    expect(evaluations).toEqual([]);
  });

  test("is on in local development without asking the flag service", async () => {
    expect(await flagStateWith({ NODE_ENV: "development" })).toBe("enabled");
    expect(evaluations).toEqual([]);
  });
});
