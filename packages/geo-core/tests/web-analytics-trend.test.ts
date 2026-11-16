import { afterAll, beforeAll, expect, mock, test } from "bun:test";

import { Effect } from "effect";

import { geoTrafficWindowParams } from "../src/geo/window";
import {
  isIsolatedTestWorker,
  testInIsolatedProcess,
} from "./utils/isolated-process";

if (!isIsolatedTestWorker(import.meta.url)) {
  testInIsolatedProcess(
    "web audience comparison mapping in an isolated process",
    import.meta.url
  );
} else {
  await import("./utils/infrastructure");
  const { database, initializeDatabase, seedProject } =
    await import("./utils/database");
  const client = await import("@notra/analytics/tinybird/client");
  let previous: bigint | undefined = 6n;
  const empty = async () => ({ data: [] });
  mock.module("@notra/analytics/tinybird/client", () => ({
    ...client,
    isTinybirdConfigured: () => true,
    queryWebOverview: empty,
    queryWebTimeseries: empty,
    queryWebPages: empty,
    queryWebSources: empty,
    queryWebHosts: empty,
    queryWebAiOutcomes: empty,
    queryWebEngagement: empty,
    queryWebAudience: async (params: { dimension: string }) => ({
      data: [
        {
          value: params.dimension === "country" ? "DE" : "desktop",
          visitors: 3n,
          previous_visitors: previous,
          views: 5n,
        },
      ],
    }),
  }));
  const { loadWebAnalytics } = await import("../src/geo/web-analytics");
  beforeAll(initializeDatabase, 30_000);
  afterAll(() => database.postgres.close());

  test("audience comparisons preserve distinct previous visitors and real zero baselines", async () => {
    const scope = await seedProject("trend-mapping");
    previous = 6n;
    const response = await Effect.runPromise(
      loadWebAnalytics(scope, { days: 7 }, undefined)
    );
    expect(response.countries).toEqual([
      { value: "DE", visitors: 3, previousVisitors: 6 },
    ]);
    expect(response.devices).toEqual([
      { value: "desktop", visitors: 3, previousVisitors: 6 },
    ]);
    previous = 0n;
    const newTraffic = await Effect.runPromise(
      loadWebAnalytics(scope, { days: 7 }, undefined)
    );
    expect(newTraffic.countries[0]?.previousVisitors).toBe(0);
  });

  test("an old audience pipe does not invent a zero comparison", async () => {
    const scope = await seedProject("trend-legacy");
    previous = undefined;
    const response = await Effect.runPromise(
      loadWebAnalytics(scope, { days: 7 }, undefined)
    );
    expect(response.countries[0]?.previousVisitors).toBeNull();
    expect(response.devices[0]?.previousVisitors).toBeNull();
  });
}

test("last N days is today and the N - 1 days before, compared with N days", () => {
  const now = new Date("2026-11-16T09:30:00Z");
  expect(geoTrafficWindowParams({ days: 7 }, 30, now)).toEqual({
    days: 7,
    date_from: "2026-11-10",
    date_to: "",
  });
  expect(geoTrafficWindowParams({}, 1, now).date_from).toBe("2026-11-16");
  expect(
    geoTrafficWindowParams({ from: "2026-01-01", to: "2026-01-31" }, 30, now)
  ).toEqual({ days: 30, date_from: "2026-01-01", date_to: "2026-01-31" });
});
