import "./utils/infrastructure";
import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";

import { geoProducts, geoPrompts } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { GEO_PRODUCTS_MAX } from "../src/constants/geo";
import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  testDb,
} from "./utils/database";

const { createGeoProduct, listGeoProducts, updateGeoPrompt } =
  await import("../src/geo/programs");

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(resetDatabase);

function failureTag(exit: unknown): string | undefined {
  return JSON.stringify(exit).match(/"_tag":"(Geo\w+Error)"/)?.[1];
}

test("adds a product by hand after the discovered ones", async () => {
  const scope = await seedProject("create");
  await testDb.insert(geoProducts).values({
    id: "p-main",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: "Launcher",
    position: 0,
  });

  const product = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "  Team plan ", niche: " " })
  );
  const { products } = await Effect.runPromise(listGeoProducts(scope));

  expect(product).toMatchObject({
    name: "Team plan",
    niche: null,
    position: 1,
  });
  expect(products.map((row) => row.name)).toEqual(["Launcher", "Team plan"]);
});

test("rejects a name the project already uses, ignoring case, and enforces the limit", async () => {
  const scope = await seedProject("dupes");
  await Effect.runPromise(createGeoProduct({ ...scope, name: "Launcher" }));

  const duplicate = await Effect.runPromiseExit(
    createGeoProduct({ ...scope, name: "launcher" })
  );
  expect(failureTag(duplicate)).toBe("GeoProductDuplicateError");

  for (let index = 1; index < GEO_PRODUCTS_MAX; index += 1) {
    await Effect.runPromise(
      createGeoProduct({ ...scope, name: `Product ${index}` })
    );
  }
  const overLimit = await Effect.runPromiseExit(
    createGeoProduct({ ...scope, name: "One too many" })
  );
  expect(failureTag(overLimit)).toBe("GeoProductLimitError");
});

test("moving a prompt only accepts a product from the same project", async () => {
  const scope = await seedProject("move");
  const other = await seedProject("other");
  const own = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "Launcher" })
  );
  const foreign = await Effect.runPromise(
    createGeoProduct({ ...other, name: "Elsewhere" })
  );
  await testDb.insert(geoPrompts).values({
    id: "prompt",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "best app launcher for mac",
  });

  const rejected = await Effect.runPromiseExit(
    updateGeoPrompt(scope, "prompt", { productId: foreign.id })
  );
  expect(failureTag(rejected)).toBe("GeoProductNotFoundError");

  await Effect.runPromise(
    updateGeoPrompt(scope, "prompt", { productId: own.id })
  );
  const [row] = await testDb
    .select({ productId: geoPrompts.productId })
    .from(geoPrompts)
    .where(eq(geoPrompts.id, "prompt"));
  expect(row?.productId).toBe(own.id);
});
