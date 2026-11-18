import "./utils/infrastructure";
import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

import {
  geoProducts,
  geoPromptSuggestions,
  geoPrompts,
} from "@notra/db/schema";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  testDb,
} from "./utils/database";

type Suggestion = { prompt: string; intent: string; reason: string };
let answers: Record<string, Suggestion[] | "fail"> = {};

const actualAi = await import("ai");
mock.module("ai", () => ({
  ...actualAi,
  generateText: async (options: { prompt: string }) => {
    const product = Object.keys(answers).find((name) =>
      options.prompt.startsWith(`Product: ${name}`)
    );
    const answer = product ? answers[product] : undefined;
    if (!answer || answer === "fail") {
      throw new Error("provider down");
    }
    return { output: { suggestions: answer } };
  },
}));

const { generateProductSuggestions, listProductSuggestions } =
  await import("../src/geo/product-suggestions");
const { acceptSuggestion } = await import("../src/geo/suggestions");

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(() => {
  answers = {};
  return resetDatabase();
});

async function seedProducts(organizationId: string, projectId: string) {
  await testDb.insert(geoProducts).values([
    { id: "p-email", organizationId, projectId, name: "Email", position: 0 },
    { id: "p-sms", organizationId, projectId, name: "SMS", position: 1 },
  ]);
}

test("writes new suggestions per product and skips tracked, earlier and invalid ones", async () => {
  const scope = await seedProject("suggest");
  await seedProducts(scope.organizationId, scope.projectId);
  await testDb.insert(geoPrompts).values({
    id: "tracked",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "best transactional email api",
    productId: "p-email",
  });
  await testDb.insert(geoPromptSuggestions).values({
    id: "old-dismissed",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "email api with good deliverability",
    source: "product",
    status: "dismissed",
    productId: "p-email",
  });
  answers = {
    Email: [
      {
        prompt: "Best Transactional Email API ",
        intent: "list",
        reason: "dup",
      },
      {
        prompt: "email api with good deliverability",
        intent: "list",
        reason: "dismissed before",
      },
      { prompt: "hi", intent: "list", reason: "too short" },
      {
        prompt: "how do I stop password reset emails landing in spam",
        intent: "problem",
        reason: "Deliverability pain",
      },
    ],
    SMS: [
      {
        prompt: "cheapest way to send login codes by text message",
        intent: "list",
        reason: "Login codes",
      },
    ],
  };

  const result = await Effect.runPromise(generateProductSuggestions(scope));

  expect(result.generatedAt).not.toBeNull();
  expect(result.products.map((product) => product.name)).toEqual([
    "Email",
    "SMS",
  ]);
  expect(
    result.suggestions.map((row) => [row.productId, row.prompt, row.intent])
  ).toEqual([
    [
      "p-email",
      "how do I stop password reset emails landing in spam",
      "problem",
    ],
    ["p-sms", "cheapest way to send login codes by text message", "list"],
  ]);
});

test("a failed product keeps its pending suggestions while the others refresh", async () => {
  const scope = await seedProject("partial");
  await seedProducts(scope.organizationId, scope.projectId);
  await testDb.insert(geoPromptSuggestions).values([
    {
      id: "old-email",
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      prompt: "old email suggestion",
      source: "product",
      productId: "p-email",
    },
    {
      id: "old-sms",
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      prompt: "old sms suggestion",
      source: "product",
      productId: "p-sms",
    },
  ]);
  answers = {
    Email: [
      { prompt: "new email suggestion here", intent: "how_to", reason: "New" },
    ],
    SMS: "fail",
  };

  await Effect.runPromise(generateProductSuggestions(scope));
  const { suggestions } = await Effect.runPromise(
    listProductSuggestions(scope)
  );

  expect(suggestions.map((row) => row.prompt).sort()).toEqual([
    "new email suggestion here",
    "old sms suggestion",
  ]);
});

test("tracking a product suggestion files the prompt under its product with its intent", async () => {
  const scope = await seedProject("track");
  await seedProducts(scope.organizationId, scope.projectId);
  await testDb.insert(geoPromptSuggestions).values({
    id: "to-track",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "send sms reminders for appointments",
    source: "product",
    productId: "p-sms",
    intent: "problem",
  });

  const { prompt } = await Effect.runPromise(
    acceptSuggestion({ ...scope, suggestionId: "to-track" })
  );

  const [row] = await testDb
    .select({ productId: geoPrompts.productId, intent: geoPrompts.intent })
    .from(geoPrompts)
    .where(eq(geoPrompts.id, prompt.id));
  expect(row).toEqual({ productId: "p-sms", intent: "problem" });
});

test("a replaced suggestion is kept as dismissed and never offered again, and nothing new keeps the current one", async () => {
  const scope = await seedProject("replaced");
  await seedProducts(scope.organizationId, scope.projectId);
  const first = "which email api handles bounces for me";
  const second = "how do I warm up a new sending domain";
  answers = { Email: [{ prompt: first, intent: "list", reason: "Bounces" }] };
  await Effect.runPromise(generateProductSuggestions(scope));

  answers = { Email: [{ prompt: second, intent: "how_to", reason: "Warmup" }] };
  await Effect.runPromise(generateProductSuggestions(scope));

  answers = {
    Email: [
      { prompt: first, intent: "list", reason: "Bounces again" },
      { prompt: second, intent: "how_to", reason: "Warmup again" },
    ],
  };
  const result = await Effect.runPromise(generateProductSuggestions(scope));

  const stored = await testDb
    .select({
      prompt: geoPromptSuggestions.prompt,
      status: geoPromptSuggestions.status,
    })
    .from(geoPromptSuggestions)
    .where(eq(geoPromptSuggestions.projectId, scope.projectId));
  expect(stored.map((row) => [row.prompt, row.status]).sort()).toEqual([
    [second, "pending"],
    [first, "dismissed"],
  ]);
  expect(result.suggestions.map((row) => row.prompt)).toEqual([second]);
});

test("fails when every product's call fails and keeps pending suggestions", async () => {
  const scope = await seedProject("all-failed");
  await seedProducts(scope.organizationId, scope.projectId);
  await testDb.insert(geoPromptSuggestions).values({
    id: "kept",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "old email suggestion",
    source: "product",
    productId: "p-email",
  });
  answers = { Email: "fail", SMS: "fail" };

  const exit = await Effect.runPromiseExit(generateProductSuggestions(scope));
  const { suggestions } = await Effect.runPromise(
    listProductSuggestions(scope)
  );

  expect(exit._tag).toBe("Failure");
  expect(JSON.stringify(exit)).toContain("GeoProductSuggestError");
  expect(suggestions.map((row) => row.prompt)).toEqual([
    "old email suggestion",
  ]);
});

test("tracking a suggestion that matches a tracked prompt fills in its product and intent", async () => {
  const scope = await seedProject("adopt");
  await seedProducts(scope.organizationId, scope.projectId);
  await testDb.insert(geoPrompts).values({
    id: "already-tracked",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "Send SMS reminders for appointments",
  });
  await testDb.insert(geoPromptSuggestions).values({
    id: "matching",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "send sms reminders for appointments",
    source: "product",
    productId: "p-sms",
    intent: "problem",
  });

  const { prompt } = await Effect.runPromise(
    acceptSuggestion({ ...scope, suggestionId: "matching" })
  );

  expect(prompt.id).toBe("already-tracked");
  expect([prompt.productId, prompt.intent]).toEqual(["p-sms", "problem"]);
});

test("two refreshes at once leave the product with its new suggestions", async () => {
  const scope = await seedProject("overlap");
  await seedProducts(scope.organizationId, scope.projectId);
  answers = {
    Email: [
      {
        prompt: "which email api retries failed sends for me",
        intent: "list",
        reason: "Retries",
      },
    ],
  };

  await Promise.all([
    Effect.runPromise(generateProductSuggestions(scope)),
    Effect.runPromise(generateProductSuggestions(scope)),
  ]);
  const { suggestions } = await Effect.runPromise(
    listProductSuggestions(scope)
  );

  expect(suggestions.map((row) => row.prompt)).toEqual([
    "which email api retries failed sends for me",
  ]);
});
