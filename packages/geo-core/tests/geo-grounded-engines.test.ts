import { describe, expect, test } from "bun:test";

import {
  GEO_MODEL_CATALOG_SEED,
  GEO_MODEL_PROVIDERS,
} from "../src/constants/geo-model-catalog";
import type { GeoModelCatalog } from "../src/types/geo";
import { engineModelOf } from "../src/utils/geo-engine-family";
import {
  isGeoWebSearchEngine,
  isPartialGeoScanEngineScope,
  remapRetiredGeoEngineIds,
  resolveGeoGroundedZdrMode,
  resolveTrackedEngines,
  scopeGeoScanEngines,
  unknownGeoScanEngines,
} from "../src/utils/geo-engines";
import {
  hasGroundedVariant,
  resolveGroundedEngineByKey,
  resolveGroundedEngines,
} from "../src/utils/geo-grounded-engines";
import {
  buildGeoModelCatalogFromFeed,
  geoDefaultEngines,
  geoEnginesForAudience,
  geoModelsForProvider,
  seedGeoModelCatalog,
} from "../src/utils/geo-model-catalog";
import { isGeoOlostepEngine } from "../src/utils/geo-olostep";

const catalog: GeoModelCatalog = {
  providers: [...GEO_MODEL_PROVIDERS],
  models: [...GEO_MODEL_CATALOG_SEED],
};

describe("selected grounded engines", () => {
  test("batch transport variants are not separate models, even without a base in the feed", () => {
    const available = buildGeoModelCatalogFromFeed([
      {
        id: "openai/gpt-6.1-sol",
        name: "GPT-6.1 Sol",
        owned_by: "openai",
        type: "language",
        zdr: "none",
      },
      {
        id: "openai/gpt-6.1-sol-batch",
        name: "GPT-6.1 Sol (Batch)",
        owned_by: "openai",
        type: "language",
        zdr: "none",
      },
      {
        id: "anthropic/claude-opus-5.5-batch",
        name: "Claude Opus 5.5 (Batch)",
        owned_by: "anthropic",
        type: "language",
        zdr: "none",
      },
    ]);
    expect(available.models.some((model) => model.id.endsWith("-batch"))).toBe(
      false
    );
    expect(
      geoModelsForProvider(available, "openai").map((model) => model.id)
    ).toContain("openai/gpt-6.1-sol");
    expect(
      geoDefaultEngines(available).every((id) => !id.endsWith("-batch"))
    ).toBe(true);
    expect(
      remapRetiredGeoEngineIds([
        "openai/gpt-6.1-sol-batch",
        "openai/gpt-6.1-sol",
      ])
    ).toEqual(["openai/chatgpt"]);
    expect(
      isPartialGeoScanEngineScope(
        ["openai/gpt-6.1-sol-batch"],
        ["openai/chatgpt"]
      )
    ).toBe(false);
  });

  test("saved batch approvals and retired models canonicalize without rewriting historical check identities", () => {
    expect(
      remapRetiredGeoEngineIds([
        "spacexai/grok-4.6-batch",
        "spacexai/grok-4.7",
        "openai/gpt-6.1-sol-batch",
      ])
    ).toEqual(["spacexai/grok-4.20-non-reasoning", "openai/chatgpt"]);
    expect(engineModelOf("openai/gpt-6.1-sol-batch-grounded")).toBe(
      "openai/gpt-6.1-sol-batch"
    );
  });

  test("empty or unsupported selections do not inject default search models", () => {
    expect(resolveGroundedEngines([], catalog).length).toBe(0);
    expect(resolveGroundedEngines(["unlisted/model"], catalog).length).toBe(0);
    expect(resolveGroundedEngines(["moonshotai/kimi-k3"], catalog).length).toBe(
      0
    );
  });

  test("queued keys preserve the exact model rather than using a default", () => {
    expect(
      resolveGroundedEngineByKey("anthropic/claude-sonnet-5-grounded")?.model
    ).toBe("anthropic/claude-sonnet-5");
    expect(
      resolveGroundedEngineByKey("anthropic/claude-sonnet-4.6-grounded")?.model
    ).toBe("anthropic/claude-sonnet-4.6");
    expect(resolveGroundedEngineByKey("anthropic/claude-sonnet-5")).toBe(null);
  });
});

describe("released consumer apps", () => {
  const unreleased = ["perplexity/perplexity"];

  test("unreleased apps stay hidden, even from stale settings", () => {
    const previous = {
      olostep: process.env.GEO_OLOSTEP_API_KEY_ENV,
      context: process.env.CONTEXT_DEV_API_KEY,
    };
    try {
      process.env.GEO_OLOSTEP_API_KEY_ENV = "test-key";
      process.env.CONTEXT_DEV_API_KEY = "test-key";
      const feed = unreleased.map((id) => ({
        id,
        name: id,
        owned_by: id.split("/")[0] ?? "",
        type: "language",
        zdr: "none" as const,
      }));
      for (const available of [
        seedGeoModelCatalog(),
        buildGeoModelCatalogFromFeed(feed),
      ]) {
        const ids = available.models.map((model) => model.id);
        expect(ids.filter(isGeoOlostepEngine)).toEqual([
          "openai/chatgpt",
          "google/ai-mode",
          "microsoft/copilot",
        ]);
        expect(ids).toContain("google/gemini");
        expect(ids).toContain("google/ai-overview");
        expect(
          resolveTrackedEngines(available, [...unreleased, "openai/chatgpt"])
        ).toEqual(["openai/chatgpt"]);
        expect(resolveTrackedEngines(available, unreleased)).toEqual(
          geoDefaultEngines(available)
        );
        expect(
          scopeGeoScanEngines(available, ["openai/chatgpt"], unreleased)
        ).toEqual([]);
      }
      const seeded = seedGeoModelCatalog();
      expect(seeded.models.map((model) => model.id)).toContain(
        "perplexity/sonar"
      );
      expect(geoEnginesForAudience(seeded, "general")).toEqual([
        "openai/chatgpt",
        "google/gemini",
      ]);
      expect(geoEnginesForAudience(seeded, "commerce")).toEqual([
        "openai/chatgpt",
        "google/gemini",
        "google/ai-overview",
      ]);
    } finally {
      for (const [key, value] of [
        ["GEO_OLOSTEP_API_KEY_ENV", previous.olostep],
        ["CONTEXT_DEV_API_KEY", previous.context],
      ] as const) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});

describe("partial engine scope", () => {
  const tracked = ["anthropic/claude-haiku-5.5", "openai/chatgpt"];

  test("only a selection that leaves out a tracked engine is partial", () => {
    expect(isPartialGeoScanEngineScope(tracked, ["openai/chatgpt"])).toBe(true);
    expect(isPartialGeoScanEngineScope(tracked, [...tracked].reverse())).toBe(
      false
    );
    expect(
      isPartialGeoScanEngineScope(tracked, [...tracked, "google/gemini"])
    ).toBe(false);
    expect(
      isPartialGeoScanEngineScope(
        ["spacexai/grok-4.6"],
        ["spacexai/grok-4.20-non-reasoning"]
      )
    ).toBe(false);
  });
});

describe("explicit scan engine selections", () => {
  test("names the engines a scan would silently drop", () => {
    // Models no policy swaps for another, so the request names what runs.
    const [visible, hiddenModel] = catalog.models.filter(
      (model) =>
        !model.hidden && remapRetiredGeoEngineIds([model.id])[0] === model.id
    );
    if (!(visible && hiddenModel)) {
      throw new Error("The seed catalog needs two visible models");
    }
    const withHidden: GeoModelCatalog = {
      ...catalog,
      models: catalog.models.map((model) =>
        model.id === hiddenModel.id ? { ...model, hidden: true } : model
      ),
    };

    // A retired id maps to its replacement, so it isn't unknown.
    expect(
      unknownGeoScanEngines(
        withHidden,
        [],
        [visible.id, "spacexai/grok-4.6", "acme/nope", hiddenModel.id]
      )
    ).toEqual(["acme/nope", hiddenModel.id]);
    // The engine policy folds unknown family ids into the family default,
    // so a typo must not pass as that default.
    expect(
      unknownGeoScanEngines(withHidden, [], ["google/ai-overveiw"])
    ).toEqual(["google/ai-overveiw"]);
    // A hidden model the project already tracks can still run.
    expect(
      unknownGeoScanEngines(withHidden, [hiddenModel.id], [hiddenModel.id])
    ).toEqual([]);
  });
});
