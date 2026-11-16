import { expect, test } from "bun:test";

import {
  rawWebPreviousKept,
  startsBeforeRawWebRetention,
} from "../src/utils/web-raw-retention";

const NOW = new Date("2026-11-16T09:30:00Z");
const window = (date_from: string, date_to = "", days = 30) => ({
  days,
  date_from,
  date_to,
});

test("the previous period is compared only while raw rows still cover it", () => {
  // Last 30 days: the previous 30 start 2026-08-19, inside the 90 kept.
  expect(rawWebPreviousKept(window("2026-10-18"), NOW)).toBe(true);
  // Last 45 days: the previous period starts on the first kept day.
  expect(rawWebPreviousKept(window("2026-10-03"), NOW)).toBe(true);
  expect(rawWebPreviousKept(window("2026-10-02"), NOW)).toBe(false);
  // Last 90 days and an explicit old range.
  expect(rawWebPreviousKept(window("2026-08-19"), NOW)).toBe(false);
  expect(rawWebPreviousKept(window("2026-01-01", "2026-01-31"), NOW)).toBe(
    false
  );
  // Without a start date the pipes go back twice the days.
  expect(rawWebPreviousKept(window("", "", 30), NOW)).toBe(true);
  expect(rawWebPreviousKept(window("", "", 90), NOW)).toBe(false);
});

test("days a completed import covers never expire, so only the native rest must be kept", () => {
  // Last 90 days: the previous period is 2026-05-21 to 2026-08-18.
  const last90 = window("2026-08-19");
  expect(rawWebPreviousKept(last90, NOW, "2026-08-18")).toBe(true);
  expect(rawWebPreviousKept(last90, NOW, "2026-09-30")).toBe(true);
  // Native days from 2026-07-02 on, partly past the first kept day.
  expect(rawWebPreviousKept(last90, NOW, "2026-07-01")).toBe(false);
});

test("a range is cut short when it starts before the first kept day", () => {
  expect(startsBeforeRawWebRetention("2026-08-19", NOW)).toBe(false);
  expect(startsBeforeRawWebRetention("2026-08-18", NOW)).toBe(true);
  expect(startsBeforeRawWebRetention("2026-01-01", NOW)).toBe(true);
});
