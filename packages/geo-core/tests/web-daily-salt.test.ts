import { expect, mock, test } from "bun:test";

let failing = false;
const store = new Map<string, string>();
const ttls = new Map<string, number>();
mock.module("@notra/ai/utils/redis", () => ({
  redis: {
    set: async (
      key: string,
      value: string,
      options: { nx?: boolean; ex?: number }
    ) => {
      if (failing) {
        throw new Error("redis down");
      }
      if (options.nx && store.has(key)) {
        return null;
      }
      store.set(key, value);
      ttls.set(key, options.ex ?? 0);
      return "OK";
    },
    get: async (key: string) => store.get(key) ?? null,
  },
}));
const evlog = await import("@notra/ai/evlog");
const errors: Record<string, unknown>[] = [];
mock.module("@notra/ai/evlog", () => ({
  ...evlog,
  geoLog: {
    ...evlog.geoLog,
    error: (event: Record<string, unknown>) => errors.push(event),
  },
}));

process.env.GEO_INGEST_SECRET = "test-secret";
const { dailySalt, forgetExpiredSalts } =
  await import("../src/ingest/daily-salt");
const { addDays, toDay } = await import("../src/utils/analytics-import-range");

test("each UTC day gets a random salt that Redis deletes after 48 hours", async () => {
  const today = await dailySalt("2026-11-04");
  expect(today).toMatch(/^s_[0-9a-f]{64}$/);
  expect(await dailySalt("2026-11-04")).toBe(today);
  expect(await dailySalt("2026-11-05")).not.toBe(today);
  expect(ttls.get("web:salt:v1:2026-11-04")).toBe(48 * 60 * 60);
});

test("replicas agree on the first salt written for a day", async () => {
  store.set("web:salt:v1:2026-12-01", "s_written_by_another_replica");
  expect(await dailySalt("2026-12-01")).toBe("s_written_by_another_replica");
});

test("without Redis the salt is random, kept in memory for the day and reported", async () => {
  failing = true;
  const today = toDay(new Date());
  const salt = await dailySalt(today);
  expect(salt).toMatch(/^l_[0-9a-f]{64}$/);
  expect(salt).not.toContain("test-secret");
  expect(await dailySalt(today)).toBe(salt);
  expect(await dailySalt(addDays(today, -1))).not.toBe(salt);
  expect(
    errors.filter((event) => event.event === "geo.ingest.salt_fallback")
  ).toHaveLength(2);

  failing = false;
  expect(await dailySalt(today)).toMatch(/^s_[0-9a-f]{64}$/);
});

test("memory forgets a salt once its day is over a day old, even without beacons", async () => {
  failing = false;
  const today = toDay(new Date());
  const first = await dailySalt(today);
  // A sweep that runs today and tomorrow keeps it.
  forgetExpiredSalts(new Date(`${addDays(today, 1)}T12:00:00Z`));
  store.delete(`web:salt:v1:${today}`);
  expect(await dailySalt(today)).toBe(first);
  // The sweep the day after tomorrow drops it, as Redis already did.
  forgetExpiredSalts(new Date(`${addDays(today, 2)}T00:00:00Z`));
  expect(await dailySalt(today)).not.toBe(first);
});
