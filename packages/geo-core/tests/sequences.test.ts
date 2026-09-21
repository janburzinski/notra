import "./utils/infrastructure";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import assert from "node:assert/strict";

import { geoPromptSequences } from "@notra/db/schema";
import { Effect, Result } from "effect";

import { GEO_MAX_SEQUENCES } from "../src/constants/geo";
import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  testDb,
} from "./utils/database";

const { createGeoSequence } = await import("../src/geo/sequences");

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(resetDatabase);

describe("createGeoSequence", () => {
  test("creates the final available conversation and rejects the next", async () => {
    const scope = await seedProject("sequence-capacity");
    await testDb.insert(geoPromptSequences).values(
      Array.from({ length: GEO_MAX_SEQUENCES - 1 }, (_, index) => ({
        id: `sequence-${index}`,
        ...scope,
        name: `Conversation ${index}`,
        steps: ["Which option should I choose for my team?"],
      }))
    );

    const final = await Effect.runPromise(
      createGeoSequence(scope, {
        name: "Final conversation",
        steps: ["Which option should I choose for my team?"],
      }).pipe(Effect.result)
    );
    assert.ok(Result.isSuccess(final));

    const overflow = await Effect.runPromise(
      createGeoSequence(scope, {
        name: "One too many",
        steps: ["Which option should I choose for my team?"],
      }).pipe(Effect.result)
    );
    assert.ok(Result.isFailure(overflow));
    expect(overflow.failure._tag).toBe("GeoSequenceLimitError");
    expect(await testDb.select().from(geoPromptSequences)).toHaveLength(
      GEO_MAX_SEQUENCES
    );
  });
});
