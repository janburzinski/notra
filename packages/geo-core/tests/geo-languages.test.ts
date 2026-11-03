import { expect, test } from "bun:test";

import type { GeoPersonaSnapshotV2 } from "@notra/db/types/geo-personas";

import { buildLanguagePerformanceRows } from "../src/utils/geo-language-rows";
import { buildGeoOlostepQueries } from "../src/utils/geo-olostep-plan";
import { geoScanPersonaTasks } from "../src/utils/geo-scan-plan";
import { buildPersonaGenerationPrompt } from "../src/utils/persona-generation-prompt";

const point = (language: string) => ({
  language,
  checks: 10,
  mentions: 5,
  mentionRate: 0.5,
  citations: 0,
  visibility: 5,
  visibilityRate: 0.5,
  avgPosition: null,
});

test("a removed language is offered again instead of listed as tracked", () => {
  const rows = buildLanguagePerformanceRows({
    points: [point("German"), point("French")],
    configuredLanguages: ["German"],
    slotCount: 3,
  });
  expect(rows.map((row) => `${row.kind}:${row.language}`)).toEqual([
    "tracked:German",
    "suggested:English",
    "suggested:Spanish",
  ]);
  expect(
    buildLanguagePerformanceRows({
      points: [],
      configuredLanguages: ["German", "French"],
      slotCount: 6,
    }).some((row) => row.kind === "suggested" && row.language === "French")
  ).toBe(false);
});

test("persona answers carry the planned language, English for older plans", () => {
  const planned = {
    personaId: "p1",
    prompts: ["eins", "zwei"],
    engine: "openai/gpt-5.4-grounded",
  };
  expect(
    geoScanPersonaTasks({ ...planned, language: "German" }).map(
      (task) => task.language
    )
  ).toEqual(["German", "German"]);
  expect(geoScanPersonaTasks(planned).map((task) => task.language)).toEqual([
    "English",
    "English",
  ]);
});

test("Olostep persona queries use the planned language", () => {
  const snapshot = {
    persona: {
      role: "Founder",
      company: "SaaS",
      summary: "",
      profile: { currentStack: [] },
    },
    memories: [],
  } as unknown as GeoPersonaSnapshotV2;
  const queries = buildGeoOlostepQueries({
    tasks: [],
    sequences: [],
    personas: [
      {
        personaId: "p1",
        prompts: ["eins"],
        snapshot,
        engine: "openai/chatgpt",
        groundedKey: null,
        zdr: "off",
        language: "German",
      },
    ],
  } as unknown as Parameters<typeof buildGeoOlostepQueries>[0]);
  expect(queries.map((query) => query.language)).toEqual(["German"]);
});

test("persona prompts are written in the project's prompt language", () => {
  const prompt = buildPersonaGenerationPrompt({
    companyName: "Acme",
    websiteUrl: null,
    companyDescription: null,
    audience: null,
    competitors: [],
    pages: [],
    prompts: [],
    language: "German",
  });
  expect(prompt).toContain("for every AI engine, written in German.");
});
