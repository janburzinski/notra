import { describe, expect, mock, test } from "bun:test";
import assert from "node:assert/strict";

import { createDb, db } from "@notra/db/drizzle";

import { encryptToken } from "../crypto/token-encryption";
import type { GscIntegrationRow } from "../types/google-search-console";
import {
  GscApiError,
  hasGscGoogleAccountChanged,
  listGscSites,
  shouldClearGscSiteOnReconnect,
} from "./google-search-console";

describe("hasGscGoogleAccountChanged", () => {
  test("is false when the same Google account reconnects", () => {
    expect(
      hasGscGoogleAccountChanged("owner@example.com", "owner@example.com")
    ).toBe(false);
  });

  test("treats case and surrounding whitespace as the same account", () => {
    expect(
      hasGscGoogleAccountChanged("  Owner@Example.com ", "owner@example.com")
    ).toBe(false);
  });

  test("is true when a different Google account reconnects", () => {
    expect(
      hasGscGoogleAccountChanged("owner@example.com", "other@example.com")
    ).toBe(true);
  });

  test("treats a missing or blank next email as a changed account", () => {
    expect(hasGscGoogleAccountChanged("owner@example.com", null)).toBe(true);
    expect(hasGscGoogleAccountChanged("owner@example.com", "   ")).toBe(true);
    expect(hasGscGoogleAccountChanged(null, null)).toBe(true);
  });

  test("does not treat a first connect as a changed account", () => {
    expect(hasGscGoogleAccountChanged(null, "owner@example.com")).toBe(false);
    expect(hasGscGoogleAccountChanged(undefined, "owner@example.com")).toBe(
      false
    );
  });
});

describe("shouldClearGscSiteOnReconnect", () => {
  test("is false on first connect", () => {
    expect(shouldClearGscSiteOnReconnect(null, "owner@example.com")).toBe(
      false
    );
    expect(shouldClearGscSiteOnReconnect(null, null)).toBe(false);
  });

  test("is false when the same Google account reconnects", () => {
    expect(
      shouldClearGscSiteOnReconnect(
        { googleAccountEmail: "owner@example.com", siteUrl: "https://a.com/" },
        "owner@example.com"
      )
    ).toBe(false);
  });

  test("is true when a different Google account reconnects", () => {
    expect(
      shouldClearGscSiteOnReconnect(
        { googleAccountEmail: "owner@example.com", siteUrl: "https://a.com/" },
        "other@example.com"
      )
    ).toBe(true);
  });

  test("is true when a property is selected but the previous email was never stored", () => {
    expect(
      shouldClearGscSiteOnReconnect(
        { googleAccountEmail: null, siteUrl: "https://a.com/" },
        "other@example.com"
      )
    ).toBe(true);
  });

  test("is false when no property is selected and the previous email is missing", () => {
    expect(
      shouldClearGscSiteOnReconnect(
        { googleAccountEmail: null, siteUrl: null },
        "owner@example.com"
      )
    ).toBe(false);
  });
});

test("refresh only calls Google APIs after its token is persisted", async () => {
  const originalDb = db;
  const originalFetch = globalThis.fetch;
  const environment = {
    GOOGLE_SEARCH_CONSOLE_CLIENT_ID:
      process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID,
    GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET:
      process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY,
  };
  try {
    process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID = "test-client";
    process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET = "test-secret";
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64"
    );
    const integration: GscIntegrationRow = {
      id: "gsc_test",
      organizationId: "org_test",
      createdByUserId: "user_test",
      googleAccountEmail: "owner@example.com",
      encryptedAccessToken: encryptToken("initial-access"),
      encryptedRefreshToken: encryptToken("initial-refresh"),
      accessTokenExpiresAt: new Date(0),
      siteUrl: "https://example.com/",
      status: "active",
      disconnectingAt: null,
      qstashScheduleId: null,
      lastSyncedAt: null,
      lastError: null,
      topQueries: [],
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    for (const retryAfterUnauthorized of [false, true]) {
      for (const integrationUnchanged of [false, true]) {
        let writes = 0;
        const events: string[] = [];
        mock.module("@notra/db/drizzle", () => ({
          createDb,
          db: {
            update: () => ({
              set: () => ({
                where: () => ({
                  returning: async () => {
                    writes += 1;
                    events.push(
                      integrationUnchanged ? "persist" : "persist-rejected"
                    );
                    return integrationUnchanged ? [integration] : [];
                  },
                }),
              }),
            }),
          },
        }));
        integration.accessTokenExpiresAt = retryAfterUnauthorized
          ? new Date(Date.now() + 3_600_000)
          : new Date(0);
        const requests: Request[] = [];
        globalThis.fetch = async (
          input: string | URL | Request,
          init?: RequestInit
        ) => {
          const request = new Request(input, init);
          requests.push(request);
          if (request.url.endsWith("/token")) {
            events.push("fetch-token");
            return Response.json({
              access_token: "refreshed-access",
              expires_in: 3600,
            });
          }
          events.push(`fetch-sites:${request.headers.get("Authorization")}`);
          if (retryAfterUnauthorized && requests.length === 1) {
            return new Response(null, { status: 401 });
          }
          return Response.json({ siteEntry: [] });
        };

        const result = listGscSites(integration);
        if (integrationUnchanged) {
          assert.deepEqual(await result, []);
          assert.equal(
            requests.at(-1)?.headers.get("Authorization"),
            "Bearer refreshed-access"
          );
        } else {
          await assert.rejects(
            result,
            (error: unknown) =>
              error instanceof GscApiError && error.status === 409
          );
        }
        assert.deepEqual(events, [
          ...(retryAfterUnauthorized
            ? ["fetch-sites:Bearer initial-access"]
            : []),
          "fetch-token",
          integrationUnchanged ? "persist" : "persist-rejected",
          ...(integrationUnchanged
            ? ["fetch-sites:Bearer refreshed-access"]
            : []),
        ]);
        assert.equal(writes, 1);
        assert.equal(
          requests.length,
          1 + Number(retryAfterUnauthorized) + Number(integrationUnchanged)
        );
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    mock.module("@notra/db/drizzle", () => ({ createDb, db: originalDb }));
    for (const [key, value] of Object.entries(environment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
