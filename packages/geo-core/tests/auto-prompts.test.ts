import "./utils/infrastructure";
import { afterAll, beforeAll, expect, mock, test } from "bun:test";
import assert from "node:assert/strict";

import { geoPrompts } from "@notra/db/schema";
import { MockLanguageModelV4 } from "ai/test";
import { Effect } from "effect";

import { seedGeoModelCatalog } from "../src/utils/geo-model-catalog";
import {
  database,
  initializeDatabase,
  seedProject,
  settingsFor,
  testDb,
} from "./utils/database";

const model = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [],
    finishReason: { unified: "length", raw: "length" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  }),
});
const actualGateway = await import("@notra/ai/gateway");
mock.module("@notra/ai/gateway", () => ({
  ...actualGateway,
  gateway: () => model,
}));

const { loadGeoScanPrompts } = await import("../src/geo/scan-prompts");
const { toGeoSettings } = await import("../src/geo/mappers");

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());

test("missing structured auto prompts do not block enabled custom prompts", async () => {
  const scope = await seedProject("prompt-fallback");
  const prompt = "Which email tools work best for small teams?";
  await testDb.insert(geoPrompts).values({
    ...scope,
    id: "email-tools",
    prompt,
  });
  const row = await settingsFor(scope.projectId);
  assert.ok(row);

  const settings = toGeoSettings(row, seedGeoModelCatalog(false));
  const result = await Effect.runPromise(loadGeoScanPrompts(settings));

  expect(model.doGenerateCalls).toHaveLength(1);
  expect(result.prompts).toEqual([{ id: "custom-email-tools", text: prompt }]);
  expect((await settingsFor(scope.projectId))?.autoPrompts).toBeNull();
});
