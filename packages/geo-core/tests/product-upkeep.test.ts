import "./utils/infrastructure";
import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

import { geoProducts, geoPrompts, geoSettings } from "@notra/db/schema";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  testDb,
} from "./utils/database";

/** Product the sort call files each prompt under, by prompt text. */
let sortAnswers: Record<string, string> = {};
/** Products the site check call returns. */
let siteProducts: { name: string; niche: string }[] = [];
let siteContent = "";
let siteCheckCalls = 0;

type ModelCall = {
  prompt: string;
  providerOptions?: { gateway?: { tags?: string[] } };
};

const actualAi = await import("ai");
mock.module("ai", () => ({
  ...actualAi,
  generateText: async (options: ModelCall) => {
    const tags = options.providerOptions?.gateway?.tags ?? [];
    if (tags.includes("geo-product-site-check")) {
      siteCheckCalls += 1;
      return { output: { products: siteProducts } };
    }
    if (!tags.includes("geo-product-sort")) {
      throw new Error("provider down");
    }
    const listed = options.prompt.split("Prompts:\n")[1] ?? "";
    const prompts = listed.split("\n").flatMap((line) => {
      const match = line.match(/^(\d+)\. (.*)$/);
      return match
        ? [
            {
              index: Number(match[1]),
              product: sortAnswers[match[2] ?? ""] ?? null,
              intent: null,
            },
          ]
        : [];
    });
    return { output: { prompts } };
  },
}));

const actualContextDev = await import("@notra/ai/utils/context-dev");
mock.module("@notra/ai/utils/context-dev", () => ({
  ...actualContextDev,
  scrapeWebsiteForBrandAnalysis: async () => ({
    success: true,
    content: siteContent,
  }),
}));

const { createGeoProduct, deleteGeoProduct, updateGeoProduct } =
  await import("../src/geo/programs");
const { checkGeoProductsOnSite } =
  await import("../src/geo/product-site-check");

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(() => {
  sortAnswers = {};
  siteProducts = [];
  siteContent = "";
  siteCheckCalls = 0;
  return resetDatabase();
});

function failureTag(exit: unknown): string | undefined {
  return JSON.stringify(exit).match(/"_tag":"(Geo\w+Error)"/)?.[1];
}

async function productNames(projectId: string) {
  const rows = await testDb
    .select({ name: geoProducts.name })
    .from(geoProducts)
    .where(eq(geoProducts.projectId, projectId));
  return rows.map((row) => row.name).sort();
}

test("renaming keeps a product's prompts and rejects a name another product uses", async () => {
  const scope = await seedProject("rename");
  const { product: launcher } = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "Launcher" })
  );
  await Effect.runPromise(createGeoProduct({ ...scope, name: "Notes" }));
  await testDb.insert(geoPrompts).values({
    id: "prompt",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "fastest app launcher for mac",
    productId: launcher.id,
  });

  const renamed = await Effect.runPromise(
    updateGeoProduct({
      ...scope,
      productId: launcher.id,
      name: "Raycast",
      niche: "Mac users who live on the keyboard",
    })
  );
  const taken = await Effect.runPromiseExit(
    updateGeoProduct({ ...scope, productId: launcher.id, name: "notes" })
  );

  expect(renamed).toMatchObject({
    id: launcher.id,
    name: "Raycast",
    niche: "Mac users who live on the keyboard",
  });
  expect(failureTag(taken)).toBe("GeoProductDuplicateError");
  const [prompt] = await testDb
    .select({ productId: geoPrompts.productId })
    .from(geoPrompts)
    .where(eq(geoPrompts.id, "prompt"));
  expect(prompt?.productId).toBe(launcher.id);
});

test("deleting a product re-files its prompts, and the site check never adds it back", async () => {
  const scope = await seedProject("delete");
  const { product: launcher } = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "Launcher" })
  );
  const { product: notes } = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "Notes" })
  );
  await testDb.insert(geoPrompts).values({
    id: "prompt",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "quick notes app that floats above other windows",
    productId: notes.id,
  });
  sortAnswers = {
    "quick notes app that floats above other windows": "Launcher",
  };

  const deleted = await Effect.runPromise(
    deleteGeoProduct({ ...scope, productId: notes.id })
  );
  siteContent = "Launcher and Notes, both for Mac.";
  siteProducts = [
    { name: "Launcher", niche: "" },
    { name: "Notes", niche: "Floating notes" },
  ];
  const check = await Effect.runPromise(checkGeoProductsOnSite(scope));

  expect(deleted).toEqual({ unfiledPrompts: 1, refiledPrompts: 1 });
  const [prompt] = await testDb
    .select({ productId: geoPrompts.productId })
    .from(geoPrompts)
    .where(eq(geoPrompts.id, "prompt"));
  expect(prompt?.productId).toBe(launcher.id);
  expect(check).toEqual({ status: "checked", added: [] });
  expect(await productNames(scope.projectId)).toEqual(["Launcher"]);

  // Adding it back by hand is a deliberate choice the check then respects.
  await Effect.runPromise(createGeoProduct({ ...scope, name: "Notes" }));
  const [settings] = await testDb
    .select({ removed: geoSettings.removedProductNames })
    .from(geoSettings)
    .where(eq(geoSettings.projectId, scope.projectId));
  expect(settings?.removed).toEqual([]);
});

test("the site check adds products the site names, and skips the model when the site is unchanged", async () => {
  const scope = await seedProject("site-check");
  await Effect.runPromise(createGeoProduct({ ...scope, name: "Launcher" }));
  siteContent =
    "Launcher opens anything. New: Raycast Notes keeps quick notes above every app.";
  siteProducts = [
    { name: "Launcher", niche: "" },
    { name: "Raycast Notes", niche: "Quick notes above every app" },
    { name: "Raycast Cloud", niche: "Not on the page" },
  ];

  const first = await Effect.runPromise(checkGeoProductsOnSite(scope));
  const second = await Effect.runPromise(checkGeoProductsOnSite(scope));

  expect(first.status).toBe("checked");
  expect(first.added.map((product) => product.name)).toEqual(["Raycast Notes"]);
  expect(second).toEqual({ status: "unchanged", added: [] });
  expect(siteCheckCalls).toBe(1);
  expect(await productNames(scope.projectId)).toEqual([
    "Launcher",
    "Raycast Notes",
  ]);
});

test("a first check adds up to four products, and a capped check reads the page again", async () => {
  const scope = await seedProject("capped");
  await Effect.runPromise(createGeoProduct({ ...scope, name: "Launcher" }));
  siteContent =
    "Launcher, Raycast Notes, Raycast Focus, Raycast Teams, Raycast Cloud and Raycast Store.";
  siteProducts = [
    { name: "Raycast Notes", niche: "" },
    { name: "Raycast Focus", niche: "" },
    { name: "Raycast Teams", niche: "" },
    { name: "Raycast Cloud", niche: "" },
    { name: "Raycast Store", niche: "" },
  ];

  const first = await Effect.runPromise(checkGeoProductsOnSite(scope));
  const second = await Effect.runPromise(checkGeoProductsOnSite(scope));

  expect(first.added).toHaveLength(4);
  expect(second.added.map((product) => product.name)).toEqual([
    "Raycast Store",
  ]);
  expect(siteCheckCalls).toBe(2);
});

test("a renamed product's old name is never added back by the site check", async () => {
  const scope = await seedProject("renamed");
  const { product } = await Effect.runPromise(
    createGeoProduct({ ...scope, name: "Launcher" })
  );
  await Effect.runPromise(
    updateGeoProduct({ ...scope, productId: product.id, name: "Raycast" })
  );
  siteContent = "Raycast, formerly Launcher, opens anything.";
  siteProducts = [
    { name: "Raycast", niche: "" },
    { name: "Launcher", niche: "" },
  ];

  const check = await Effect.runPromise(checkGeoProductsOnSite(scope));

  expect(check.added).toEqual([]);
  expect(await productNames(scope.projectId)).toEqual(["Raycast"]);
});

test("a check without enough time left defers and stays due", async () => {
  const scope = await seedProject("deferred");
  siteContent = "Raycast Notes keeps quick notes above every app.";
  siteProducts = [{ name: "Raycast Notes", niche: "" }];

  const check = await Effect.runPromise(
    checkGeoProductsOnSite(scope, Date.now() + 1000)
  );

  expect(check).toEqual({ status: "deferred", added: [] });
  expect(siteCheckCalls).toBe(0);
  const [settings] = await testDb
    .select({ checkedAt: geoSettings.productsCheckedAt })
    .from(geoSettings)
    .where(eq(geoSettings.projectId, scope.projectId));
  expect(settings?.checkedAt ?? null).toBeNull();
});
