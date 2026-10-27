import { afterEach, expect, test } from "bun:test";

import {
  isSitesFixtureFlagRequestAllowed,
  isSitesTestRequestAllowed,
} from "./sites-test-access";

const original = { ...process.env };

afterEach(() => {
  for (const key of [
    "NODE_ENV",
    "SITES_TEST_ENABLED",
    "SITES_TEST_FIXTURE_FLAGS_ENABLED",
    "DATABASE_URL",
    "DEV_AUTH_ENABLED",
    "DEV_AUTH_EMAIL",
    "WORKOS_API_KEY",
  ]) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

test("simulated Sites flag never escapes pinned local development fixtures", () => {
  process.env.NODE_ENV = "development";
  process.env.SITES_TEST_ENABLED = "true";
  process.env.DATABASE_URL =
    "postgresql://postgres@127.0.0.1:5432/notra_server_audit";
  process.env.DEV_AUTH_ENABLED = "true";
  process.env.DEV_AUTH_EMAIL = "sites-e2e-owner@example.test";
  delete process.env.WORKOS_API_KEY;
  const request = new Request("http://127.0.0.1:3000/__tests/sites", {
    headers: { host: "127.0.0.1:3000" },
  });
  delete process.env.SITES_TEST_FIXTURE_FLAGS_ENABLED;
  expect(isSitesFixtureFlagRequestAllowed(request, "sites-e2e-acme")).toBe(
    false
  );
  process.env.SITES_TEST_FIXTURE_FLAGS_ENABLED = "true";
  expect(isSitesFixtureFlagRequestAllowed(request, "sites-e2e-acme")).toBe(
    true
  );
  expect(isSitesFixtureFlagRequestAllowed(request, "real-organization")).toBe(
    false
  );
  process.env.NODE_ENV = "production";
  expect(isSitesFixtureFlagRequestAllowed(request, "sites-e2e-acme")).toBe(
    false
  );
  process.env.NODE_ENV = "development";
  expect(
    isSitesFixtureFlagRequestAllowed(
      { headers: new Headers({ host: "remote.example.test" }) },
      "sites-e2e-acme"
    )
  ).toBe(false);
  process.env.DATABASE_URL = "postgresql://postgres@127.0.0.1:5432/notra";
  expect(isSitesFixtureFlagRequestAllowed(request, "sites-e2e-acme")).toBe(
    false
  );
  process.env.DATABASE_URL =
    "postgresql://postgres@127.0.0.1:5432/notra_server_audit";
  process.env.WORKOS_API_KEY = `sk_${"synthetic".repeat(5)}`;
  expect(isSitesFixtureFlagRequestAllowed(request, "sites-e2e-acme")).toBe(
    false
  );
  delete process.env.WORKOS_API_KEY;
  delete process.env.DEV_AUTH_ENABLED;
  expect(isSitesFixtureFlagRequestAllowed(request, "sites-e2e-acme")).toBe(
    false
  );
});

test("Sites test status is opt-in, development-only, and isolated", () => {
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL =
    "postgresql://postgres:synthetic@127.0.0.1:5432/notra_server_audit";
  const request = new Request("http://localhost:3000/__tests/sites", {
    headers: { host: "localhost:3000" },
  });
  delete process.env.SITES_TEST_ENABLED;
  expect(isSitesTestRequestAllowed(request)).toBe(false);
  process.env.SITES_TEST_ENABLED = "true";
  expect(isSitesTestRequestAllowed(request)).toBe(true);
  process.env.NODE_ENV = "production";
  expect(isSitesTestRequestAllowed(request)).toBe(false);
  process.env.NODE_ENV = "development";
  for (const url of [
    "postgresql://postgres@remote.example.test/notra_server_audit",
    "postgresql://postgres@127.0.0.1/notra",
    "postgresql://postgres@127.0.0.1/notra_server_audit?host=remote.example.test",
  ]) {
    process.env.DATABASE_URL = url;
    expect(isSitesTestRequestAllowed(request)).toBe(false);
  }
});

test("Sites test status rejects tunnels and forwarded hosts", () => {
  process.env.NODE_ENV = "development";
  process.env.SITES_TEST_ENABLED = "true";
  process.env.DATABASE_URL =
    "postgresql://postgres@127.0.0.1:55447/notra_server_audit";
  expect(
    isSitesTestRequestAllowed(
      new Request("http://localhost:3000/__tests/sites", {
        headers: new Headers({ host: "localhost:3000" }),
      })
    )
  ).toBe(true);
  for (const headers of [
    new Headers({ host: "staging.example.test" }),
    new Headers({ host: "0.0.0.0:3000" }),
    new Headers({ host: "localhost:3000", "x-forwarded-for": "203.0.113.1" }),
    new Headers({ host: "localhost:3000", "cf-ray": "synthetic" }),
    new Headers({
      host: "localhost:3000",
      forwarded: "host=staging.example.test",
    }),
    new Headers({ host: "localhost:3000", "x-forwarded-host": "localhost" }),
  ]) {
    expect(
      isSitesTestRequestAllowed(
        new Request("http://localhost:3000/__tests/sites", { headers })
      )
    ).toBe(false);
  }
});
