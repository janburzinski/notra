import { beforeEach, expect, mock, test } from "bun:test";

import { Unkey } from "@unkey/api";
import { HTTPClient } from "@unkey/api/lib/http";
import { NotFoundErrorResponse } from "@unkey/api/models/errors";

const fetcher = mock(async (_request: Request) =>
  Response.json({ meta: { requestId: "local-test" }, data: {} })
);
const client = new Unkey({
  rootKey: "local-test-key",
  httpClient: new HTTPClient({
    fetcher: (input, init) => fetcher(new Request(input, init)),
  }),
  retryConfig: { strategy: "none" },
});

mock.module("@/lib/api-keys/unkey", () => ({ unkey: client }));

const { createDemoApiKey, deleteDemoApiKey, updateDemoApiKey } =
  await import("../../src/lib/demo/api-key");

const createInput = {
  organizationId: "org-demo",
  anonymousId: "anon-demo",
  expiresAt: new Date("2026-11-03T12:00:00Z"),
};

beforeEach(() => {
  mock.module("@/lib/api-keys/unkey", () => ({ unkey: client }));
  fetcher.mockReset();
  fetcher.mockImplementation(async () =>
    Response.json({ meta: { requestId: "local-test" }, data: {} })
  );
});

test("permanently deletes the requested key", async () => {
  await expect(deleteDemoApiKey("key-demo")).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [request] = fetcher.mock.calls[0] ?? [];
  if (!request) {
    throw new Error("Expected a delete request");
  }
  expect(new URL(request.url).pathname).toBe("/v2/keys.deleteKey");
  expect(await request.json()).toEqual({
    keyId: "key-demo",
    permanent: true,
  });
});

test("an already absent key and repeated cleanup both succeed", async () => {
  await deleteDemoApiKey("key-deleted");
  fetcher.mockImplementation(async () =>
    Response.json(
      {
        meta: { requestId: "local-missing" },
        error: {
          detail: "We could not find the requested key.",
          status: 404,
          title: "Not Found",
          type: "https://example.invalid/key-not-found",
        },
      },
      { status: 404 }
    )
  );
  await expect(deleteDemoApiKey("key-absent")).resolves.toBeUndefined();
  await expect(deleteDemoApiKey("key-deleted")).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(3);
  await expect(updateDemoApiKey({ keyId: "key-demo" })).rejects.toBeInstanceOf(
    NotFoundErrorResponse
  );
});

test.each([401, 403, 429, 500])(
  "preserves an SDK %i failure",
  async (status) => {
    fetcher.mockImplementation(async () =>
      Response.json(
        {
          meta: { requestId: "local-failure" },
          error: {
            detail: "Cleanup failed",
            status,
            title: "Cleanup failed",
            type: "https://example.invalid/failure",
          },
        },
        { status }
      )
    );
    await expect(deleteDemoApiKey("key-demo")).rejects.toMatchObject({
      statusCode: status,
    });
  }
);

test("preserves unknown failures even when they resemble a 404", async () => {
  const failure = Object.assign(
    new Error("We could not find the requested key."),
    {
      statusCode: 404,
    }
  );
  mock.module("@/lib/api-keys/unkey", () => ({
    unkey: {
      keys: {
        deleteKey: async () => {
          throw failure;
        },
      },
    },
  }));
  await expect(deleteDemoApiKey("key-demo")).rejects.toBe(failure);
});

test("creates a sandbox key in the demo keyspace", async () => {
  process.env.UNKEY_API_ID = "api-demo";
  fetcher.mockImplementation(async () =>
    Response.json({
      meta: { requestId: "local-create" },
      data: { key: "ntra_demo_secret", keyId: "key-new" },
    })
  );
  await expect(createDemoApiKey(createInput)).resolves.toEqual({
    key: "ntra_demo_secret",
    keyId: "key-new",
  });
  const [request] = fetcher.mock.calls[0] ?? [];
  expect(new URL(request?.url ?? "").pathname).toBe("/v2/keys.createKey");
  expect(await request?.json()).toMatchObject({
    apiId: "api-demo",
    externalId: "org-demo",
  });
});

test("creating a key fails loudly when Unkey is not configured", async () => {
  process.env.UNKEY_API_ID = "api-demo";
  mock.module("@/lib/api-keys/unkey", () => ({ unkey: null }));
  await expect(createDemoApiKey(createInput)).rejects.toThrow(
    "UNKEY_ROOT_KEY and UNKEY_API_ID"
  );

  mock.module("@/lib/api-keys/unkey", () => ({ unkey: client }));
  delete process.env.UNKEY_API_ID;
  await expect(createDemoApiKey(createInput)).rejects.toThrow(
    "UNKEY_ROOT_KEY and UNKEY_API_ID"
  );
  expect(fetcher).not.toHaveBeenCalled();
});

test("cleanup is a no-op when Unkey is not configured", async () => {
  mock.module("@/lib/api-keys/unkey", () => ({ unkey: null }));
  await expect(deleteDemoApiKey("key-demo")).resolves.toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
});
