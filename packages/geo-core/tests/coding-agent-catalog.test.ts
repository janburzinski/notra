import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";

import { Effect } from "effect";

import {
  GEO_CURSOR_ENGINE_ID,
  GEO_OPENCODE_ENGINE_ID,
} from "../src/constants/geo";
import { GeoFeatureFlagService } from "../src/deps";
import { loadGeoModelCatalog } from "../src/geo/model-catalog";
import {
  geoEngineUsedWebSearch,
  isGeoNativeSearchEngine,
  resolveGeoEngineGateway,
  resolveGeoZdrMode,
  scopeGeoScanEngines,
} from "../src/utils/geo-engines";
import { seedGeoModelCatalog } from "../src/utils/geo-model-catalog";
import { CODING_AGENT_TARGETS } from "./constants/coding-agents";

const envKeys = [
  "UPSTASH_BOX_API_KEY",
  "OPENROUTER_API_KEY",
  "CURSOR_API_KEY",
] as const;
const originalEnv = envKeys.map((key) => process.env[key]);
const feed = spyOn(globalThis, "fetch").mockImplementation(async () =>
  Response.json({
    data: [
      {
        id: "openai/gpt-5.4-mini",
        name: "GPT-5.4 mini",
        owned_by: "openai",
        type: "language",
        zdr: "all",
      },
    ],
  })
);

beforeAll(() => {
  for (const key of envKeys) {
    process.env[key] = "test-only-never-sent";
  }
});
beforeEach(() => {
  for (const key of envKeys) {
    process.env[key] = "test-only-never-sent";
  }
});
afterAll(() => {
  feed.mockRestore();
  for (const [index, key] of envKeys.entries()) {
    if (originalEnv[index] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[index];
    }
  }
});

describe("coding-agent catalog and flag boundaries", () => {
  test.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "Cursor=%s and Box=%s independently gate every coding engine",
    async (cursorEnabled, openCodeEnabled) => {
      const catalog = await Effect.runPromise(
        loadGeoModelCatalog(`flags-${cursorEnabled}-${openCodeEnabled}`).pipe(
          Effect.provideService(GeoFeatureFlagService, {
            isCursorEngineEnabledForOrganization: () =>
              Effect.succeed(cursorEnabled),
            isOpenCodeEngineEnabledForOrganization: () =>
              Effect.succeed(openCodeEnabled),
          })
        )
      );
      expect(
        catalog.models.some((model) => model.id === GEO_CURSOR_ENGINE_ID)
      ).toBe(cursorEnabled);
      for (const [engine] of CODING_AGENT_TARGETS) {
        expect(catalog.models.some((model) => model.id === engine)).toBe(
          openCodeEnabled
        );
      }
      expect(
        catalog.models.some((model) => model.id === "openai/gpt-5.4-mini")
      ).toBe(true);
      if (!openCodeEnabled) {
        expect(
          catalog.providers.some((provider) =>
            ["opencode", "claude-code", "codex"].includes(provider.id)
          )
        ).toBe(false);
        expect(
          scopeGeoScanEngines(
            catalog,
            [],
            CODING_AGENT_TARGETS.map(([engine]) => engine)
          )
        ).toEqual([]);
      }
    }
  );

  test.each(CODING_AGENT_TARGETS)(
    "%s needs a Box key, is native search, and requires explicit non-ZDR approval",
    (engine) => {
      const catalog = seedGeoModelCatalog();
      expect(resolveGeoEngineGateway(catalog, engine)).toBe("box");
      expect(isGeoNativeSearchEngine(catalog, engine)).toBe(true);
      expect(geoEngineUsedWebSearch(engine)).toBe(true);
      expect(
        resolveGeoZdrMode(catalog, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [],
        })
      ).toBeNull();
      expect(
        resolveGeoZdrMode(catalog, engine, {
          enforceZdr: true,
          nonZdrApprovedEngines: [engine],
        })
      ).toBe("preferred");
      process.env.UPSTASH_BOX_API_KEY = " \n ";
      expect(
        seedGeoModelCatalog().models.some((model) => model.id === engine)
      ).toBe(false);
    }
  );

  test("OpenCode requires OpenRouter while native Claude Code and Codex do not", () => {
    delete process.env.OPENROUTER_API_KEY;
    const catalog = seedGeoModelCatalog();
    expect(
      catalog.models.some((model) => model.id === GEO_OPENCODE_ENGINE_ID)
    ).toBe(false);
    for (const [engine, harness] of CODING_AGENT_TARGETS) {
      if (harness) {
        expect(catalog.models.some((model) => model.id === engine)).toBe(true);
      }
    }
  });
});
