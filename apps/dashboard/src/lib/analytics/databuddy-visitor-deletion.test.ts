import { afterAll, afterEach, beforeEach, expect, spyOn, test } from "bun:test";

import { DATABUDDY_VISITOR_DELETION_URL } from "@/constants/analytics";

import { deleteDatabuddyVisitor } from "./databuddy-visitor-deletion";

const ENV_KEYS = [
  "DATABUDDY_API_KEY",
  "NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID",
] as const;
const original = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);
let status = 200;
const fetchSpy = spyOn(globalThis, "fetch");

beforeEach(() => {
  process.env.DATABUDDY_API_KEY = "synthetic-key";
  process.env.NEXT_PUBLIC_DATABUDDY_DASHBOARD_WEBSITE_ID = "synthetic-website";
  status = 200;
  fetchSpy.mockReset();
  fetchSpy.mockImplementation(
    (async () => new Response(null, { status })) as unknown as typeof fetch
  );
});

afterAll(() => {
  fetchSpy.mockRestore();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

test("asks Databuddy to erase the identified user on the dashboard website", async () => {
  await deleteDatabuddyVisitor("user-1");
  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  expect(url).toBe(DATABUDDY_VISITOR_DELETION_URL);
  expect(init?.method).toBe("POST");
  expect(init?.headers).toMatchObject({ "x-api-key": "synthetic-key" });
  expect(JSON.parse(String(init?.body))).toEqual({
    websiteId: "synthetic-website",
    visitorId: "user-1",
  });
});

test("throws with the user ID when Databuddy refuses", async () => {
  status = 403;
  await expect(deleteDatabuddyVisitor("user-1")).rejects.toThrow(
    "Databuddy visitor deletion for user user-1 failed with status 403"
  );
});

test("does nothing without Databuddy credentials", async () => {
  delete process.env.DATABUDDY_API_KEY;
  await deleteDatabuddyVisitor("user-1");
  expect(fetchSpy).not.toHaveBeenCalled();
});
