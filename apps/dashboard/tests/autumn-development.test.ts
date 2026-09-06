import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "bun:test";

import { FEATURES } from "@notra/ai/billing/features";
import { autumnHandler } from "autumn-js/next";

import { createDevelopmentAutumnHandler } from "../src/utils/development-autumn";

describe("development Autumn handler", () => {
  test("returns a customer that passes Autumn checks for every feature", async () => {
    const handler = createDevelopmentAutumnHandler("development", undefined);
    if (!handler) {
      throw new Error("Expected the missing-key development handler");
    }

    const response = handler(
      new Request("http://localhost/api/autumn/getOrCreateCustomer", {
        method: "POST",
      })
    );
    const customer = await response.json();
    // Exercise the same local checker behind useCustomer().check so SDK
    // response-contract changes fail this test.
    const reactEntry = Bun.resolveSync("autumn-js/react", import.meta.dir);
    const checkModule = await import(
      pathToFileURL(
        path.join(
          path.dirname(reactEntry),
          "hooks/internal/getLocalCheckResponse.js"
        )
      ).href
    );

    expect(response.status).toBe(200);
    for (const featureId of Object.values(FEATURES)) {
      expect(
        checkModule.getLocalCheckResponse({
          customer,
          params: { featureId, requiredBalance: Number.MAX_SAFE_INTEGER },
        }).allowed
      ).toBe(true);
    }
  });

  test("returns 503 for unsupported operations", async () => {
    const handler = createDevelopmentAutumnHandler("development", undefined);
    if (!handler) {
      throw new Error("Expected the missing-key development handler");
    }

    const response = handler(
      new Request("http://localhost/api/autumn/attach", { method: "POST" })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Billing operations are unavailable without an Autumn key",
    });
  });

  test("does not bypass Autumn when a development key is configured", () => {
    expect(
      createDevelopmentAutumnHandler("development", "autumn-secret")
    ).toBeNull();
  });

  test("fails closed for a missing key outside development", async () => {
    expect(createDevelopmentAutumnHandler("production", undefined)).toBeNull();

    const originalSecretKey = process.env.AUTUMN_SECRET_KEY;
    try {
      delete process.env.AUTUMN_SECRET_KEY;
      const { POST } = autumnHandler({ identify: async () => null });
      const response = await POST(
        new Request("http://localhost/api/autumn/getOrCreateCustomer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ code: "no_secret_key" });
    } finally {
      if (originalSecretKey === undefined) {
        delete process.env.AUTUMN_SECRET_KEY;
      } else {
        process.env.AUTUMN_SECRET_KEY = originalSecretKey;
      }
    }
  });
});
