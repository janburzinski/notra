import "./utils/infrastructure";
import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

import {
  geoProducts,
  geoPromptSuggestions,
  geoPrompts,
} from "@notra/db/schema";
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

/** Product the sort call files each prompt under, by prompt text. */
let sortAnswers: Record<string, string> = {};
let sortCalls = 0;
let failImportSort = false;

const productSort = await import("../src/geo/product-sort");
const sortNewPrompts = productSort.sortNewPromptsIntoProducts;
const sortImportedPrompts = mock<typeof sortNewPrompts>((...args) =>
  failImportSort
    ? Effect.die("post-commit sorter failed")
    : sortNewPrompts(...args)
);
mock.module("../src/geo/product-sort", () => ({
  ...productSort,
  sortNewPromptsIntoProducts: sortImportedPrompts,
}));

const actualAi = await import("ai");
mock.module("ai", () => ({
  ...actualAi,
  generateText: async (options: {
    prompt: string;
    providerOptions?: { gateway?: { tags?: string[] } };
  }) => {
    // Only the product sort is answered; other model calls fail quietly.
    if (!options.providerOptions?.gateway?.tags?.includes("geo-product-sort")) {
      throw new Error("provider down");
    }
    sortCalls += 1;
    const listed = options.prompt.split("Prompts:\n")[1] ?? "";
    const prompts = listed
      .split("\n")
      .map((line) => line.match(/^(\d+)\. (.*)$/))
      .flatMap((match) =>
        match
          ? [
              {
                index: Number(match[1]),
                product: sortAnswers[match[2] ?? ""] ?? null,
                intent: null,
              },
            ]
          : []
      );
    return { output: { prompts } };
  },
}));

const {
  createGeoProduct,
  createGeoPrompt,
  importGeoPrompts,
  listGeoProducts,
  updateGeoPrompt,
} = await import("../src/geo/programs");
const { acceptSuggestion } = await import("../src/geo/suggestions");

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(() => {
  sortAnswers = {};
  sortCalls = 0;
  failImportSort = false;
  sortImportedPrompts.mockClear();
  return resetDatabase();
});

function failureTag(exit: unknown): string | undefined {
  return JSON.stringify(exit).match(/"_tag":"(Geo\w+Error)"/)?.[1];
}

async function productOf(promptId: string) {
  const [row] = await testDb
    .select({ productId: geoPrompts.productId })
    .from(geoPrompts)
    .where(eq(geoPrompts.id, promptId));
  return row?.productId ?? null;
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

  const { product } = await Effect.runPromise(
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
  const { product: own } = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "Launcher" })
  );
  const { product: foreign } = await Effect.runPromise(
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
  expect(await productOf("prompt")).toBe(own.id);
});

test("a new product picks up prompts without a product that fit it, and only those", async () => {
  const scope = await seedProject("pick-up");
  await testDb.insert(geoProducts).values({
    id: "p-main",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: "Launcher",
    position: 0,
  });
  await testDb.insert(geoPrompts).values([
    {
      id: "fits-new",
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      prompt: "shared snippets for my whole team",
    },
    {
      id: "fits-old",
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      prompt: "fastest app launcher for mac",
    },
    {
      id: "already-filed",
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      prompt: "team plan pricing",
      productId: "p-main",
    },
  ]);
  sortAnswers = {
    "shared snippets for my whole team": "Team plan",
    "fastest app launcher for mac": "Launcher",
    "team plan pricing": "Team plan",
  };

  const { product, sortedPrompts } = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "Team plan" })
  );

  expect(sortedPrompts).toBe(1);
  expect(await productOf("fits-new")).toBe(product.id);
  // Left alone: a prompt someone kept without a product, and a filed one.
  expect(await productOf("fits-old")).toBeNull();
  expect(await productOf("already-filed")).toBe("p-main");
});

test("a new prompt is filed into the product that fits it", async () => {
  const scope = await seedProject("new-prompt");
  await testDb.insert(geoProducts).values({
    id: "p-main",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: "Launcher",
    position: 0,
  });
  sortAnswers = { "fastest app launcher for mac": "Launcher" };

  const filed = await Effect.runPromise(
    createGeoPrompt(scope, "fastest app launcher for mac")
  );
  const unfiled = await Effect.runPromise(
    createGeoPrompt(scope, "who founded the company")
  );

  expect(filed.productId).toBe("p-main");
  expect(unfiled.productId ?? null).toBeNull();
});

test("projects without products never call the sorter", async () => {
  const scope = await seedProject("no-products");

  await Effect.runPromise(createGeoPrompt(scope, "fastest app launcher"));

  expect(sortCalls).toBe(0);
});

test("an import larger than one sort call is sorted in batches", async () => {
  const scope = await seedProject("big-import");
  await testDb.insert(geoProducts).values({
    id: "p-main",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: "Launcher",
    position: 0,
  });
  const rows = Array.from({ length: 250 }, (_, index) => ({
    prompt: `which mac launcher handles workflow number ${index} best`,
  }));
  sortAnswers = Object.fromEntries(rows.map((row) => [row.prompt, "Launcher"]));

  const result = await Effect.runPromise(importGeoPrompts(scope, rows));
  const filed = await testDb
    .select({ productId: geoPrompts.productId })
    .from(geoPrompts)
    .where(eq(geoPrompts.projectId, scope.projectId));

  expect(result.imported).toBe(250);
  expect(sortCalls).toBe(2);
  expect(filed.every((row) => row.productId === "p-main")).toBe(true);
});

test("reports the committed import even when enrichment fails and skips enrichment on replay", async () => {
  const scope = await seedProject("import-enrichment-failure");
  const rows = [{ prompt: "which launcher works offline?" }];
  failImportSort = true;

  expect(await Effect.runPromise(importGeoPrompts(scope, rows))).toMatchObject({
    imported: 1,
    skipped: 0,
  });
  expect(await Effect.runPromise(importGeoPrompts(scope, rows))).toMatchObject({
    imported: 0,
    skipped: 1,
  });
  expect(sortImportedPrompts).toHaveBeenCalledTimes(1);
  expect(
    await testDb
      .select()
      .from(geoPrompts)
      .where(eq(geoPrompts.projectId, scope.projectId))
  ).toHaveLength(1);
});

test("tracking a suggestion keeps a hand-added prompt's choice of no product", async () => {
  const scope = await seedProject("reused");
  await testDb.insert(geoProducts).values({
    id: "p-main",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    name: "Launcher",
    position: 0,
  });
  await testDb.insert(geoPrompts).values({
    id: "by-hand",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "fastest app launcher for mac",
  });
  await testDb.insert(geoPromptSuggestions).values({
    id: "gsc",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "Fastest app launcher for Mac",
    source: "search_console",
  });
  sortAnswers = { "fastest app launcher for mac": "Launcher" };

  const { prompt } = await Effect.runPromise(
    acceptSuggestion({ ...scope, suggestionId: "gsc" })
  );

  expect(prompt.id).toBe("by-hand");
  expect(await productOf("by-hand")).toBeNull();
  expect(sortCalls).toBe(0);
});
