import { describe, expect, test } from "bun:test";

import { getRequiredApiScope } from "../src/api-scopes";

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
