import { expect, test } from "bun:test";

import { seedGeoModelCatalog } from "@notra/geo-core/utils/geo-model-catalog";

import {
  geoPickerProviders,
  inferGeoAudience,
  pickGeoProviderEngines,
} from "./geo-engine-recommendation";

const catalog = seedGeoModelCatalog(false);
const rows = geoPickerProviders(catalog, new Set());
const modelsFor = (row: string) =>
  rows.find((entry) => entry.provider.id === row)?.models ?? [];

test("Google AI Mode, AI Overview and Gemini are separate rows", () => {
  const ids = rows.map((row) => row.provider.id);
  expect(ids.indexOf("google-ai-mode")).toBeLessThan(
    ids.indexOf("google-ai-overview")
  );
  expect(ids.indexOf("google-ai-overview")).toBeLessThan(ids.indexOf("google"));
  expect(modelsFor("google").map((model) => model.id)).not.toContain(
    "google/ai-overview"
  );
  expect(modelsFor("google").map((model) => model.id)).not.toContain(
    "google/ai-mode"
  );
});

test("technical brands run the API model, not the consumer app", () => {
  expect(pickGeoProviderEngines(modelsFor("openai"), "technical")).toEqual([
    "openai/gpt-5.6-sol",
  ]);
  expect(pickGeoProviderEngines(modelsFor("anthropic"), "technical")).toEqual([
    "anthropic/claude-haiku-5.5",
  ]);
});

test("other brands run the consumer app", () => {
  expect(pickGeoProviderEngines(modelsFor("openai"), "general")).toEqual([
    "openai/chatgpt",
  ]);
  expect(pickGeoProviderEngines(modelsFor("google"), "commerce")).toEqual([
    "google/gemini",
  ]);
});

test("each Google search row turns on its own engine", () => {
  for (const audience of ["technical", "general", "commerce"] as const) {
    expect(
      pickGeoProviderEngines(modelsFor("google-ai-overview"), audience)
    ).toEqual(["google/ai-overview"]);
    expect(
      pickGeoProviderEngines(modelsFor("google-ai-mode"), audience)
    ).toEqual(["google/ai-mode"]);
  }
});

test("the audience is read back from the tracked engines", () => {
  expect(inferGeoAudience(catalog, ["openai/gpt-5.6-sol"])).toBe("technical");
  expect(inferGeoAudience(catalog, ["openai/chatgpt"])).toBe("general");
});

test("turning on a Google search row keeps the audience", () => {
  expect(
    inferGeoAudience(catalog, ["openai/gpt-5.6-sol", "google/ai-overview"])
  ).toBe("technical");
  expect(inferGeoAudience(catalog, ["openai/chatgpt", "google/ai-mode"])).toBe(
    "general"
  );
});
