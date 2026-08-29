import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { GeoGatewayModel } from "@/types/geo";

import { buildGeoModelCatalogFromFeed } from "./geo-model-catalog";

describe("buildGeoModelCatalogFromFeed", () => {
  test("preserves confirmed gateway coverage without assuming it for new models", () => {
    const feed = [
      {
        id: "zai/glm-5.3",
        name: "GLM 5.3",
        owned_by: "zai",
        type: "language",
        zdr: "some",
        released: 1_787_270_400,
      },
      {
        id: "zai/glm-new",
        name: "GLM New",
        owned_by: "zai",
        type: "language",
        zdr: "some",
        released: 1_787_356_800,
      },
    ] satisfies GeoGatewayModel[];

    const catalog = buildGeoModelCatalogFromFeed(feed);

    assert.deepEqual(
      catalog.models.find((model) => model.id === "zai/glm-5.3")?.gateways,
      ["vercel", "openrouter"]
    );
    assert.deepEqual(
      catalog.models.find((model) => model.id === "zai/glm-new")?.gateways,
      ["vercel"]
    );
  });
});
