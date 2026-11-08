import { describe, expect, test } from "bun:test";

import { getRequiredApiScope } from "../src/api-scopes";

describe("analytics API scopes", () => {
  test.each([
    ["GET", "/v1/projects/p1/geo/traffic/web", "traffic.read"],
    ["GET", "/v1/projects/p1/geo/traffic/web/breakdowns", "traffic.read"],
    ["GET", "/v1/projects/p1/geo/traffic/journey-stats", "traffic.read"],
    ["GET", "/v1/projects/p1/geo/traffic/imports", "traffic.read"],
    ["GET", "/v1/geo/ingest/setup", "traffic.read"],
    ["POST", "/v1/geo/ingest/rotate-token", "traffic.write"],
  ])("%s %s needs %s", (method, path, scope) => {
    expect(getRequiredApiScope(path, method)).toBe(scope);
  });
});

describe("Sites API scopes", () => {
  test("reads need sites.read and writes sites.write", () => {
    expect(getRequiredApiScope("/v1/sites", "GET")).toBe("sites.read");
    expect(
      getRequiredApiScope("/v1/sites/site_1/deployments/dep_1", "GET")
    ).toBe("sites.read");
    expect(getRequiredApiScope("/v1/sites/site_1/deployments", "POST")).toBe(
      "sites.write"
    );
    expect(getRequiredApiScope("/v1/sites/site_1/publications", "POST")).toBe(
      "sites.write"
    );
  });

  test("leaves post agent reach on the traffic scope", () => {
    expect(getRequiredApiScope("/v1/posts/post_1/agent-reach", "GET")).toBe(
      "traffic.read"
    );
  });
});
