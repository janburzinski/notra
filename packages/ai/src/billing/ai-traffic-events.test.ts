import { expect, mock, test } from "bun:test";

const track = mock(async (): Promise<unknown> => ({}));

mock.module("./autumn", () => ({
  autumn: { track },
  allowUnmeteredAiInDevelopment: false,
  AUTUMN_READ_TIMEOUT_MS: 5000,
}));
mock.module("../utils/server-log", () => ({
  logError: () => {},
  logWarn: () => {},
}));

const { trackAiTrafficEvent } = await import("./ai-traffic-events");

function statusError(statusCode: number) {
  return Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
}

test("only failures Autumn certainly did not record ask for a retry", async () => {
  expect(await trackAiTrafficEvent("org_1", 3)).toBe(true);
  expect(track).toHaveBeenLastCalledWith({
    customerId: "org_1",
    featureId: "ai_traffic_events",
    value: 3,
  });

  for (const [error, recorded] of [
    [statusError(429), false],
    [statusError(503), false],
    [statusError(500), true],
    [statusError(400), true],
    [new TypeError("fetch failed"), true],
  ] as const) {
    track.mockImplementationOnce(async () => {
      throw error;
    });
    expect(await trackAiTrafficEvent("org_1", 3)).toBe(recorded);
  }
});
