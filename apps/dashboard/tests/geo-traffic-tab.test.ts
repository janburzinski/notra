import { describe, expect, test } from "bun:test";

import { geoTrafficTab } from "../src/utils/geo-traffic-tab";

describe("geoTrafficTab", () => {
  test("names the analytics tab of a /geo/traffic URL", () => {
    expect(geoTrafficTab(undefined)).toBe("agents");
    expect(geoTrafficTab("")).toBe("agents");
    expect(geoTrafficTab("web")).toBe("web");
    expect(geoTrafficTab("mcp")).toBe("mcp");
  });

  test("an unknown segment is not a tab, so the route answers not found", () => {
    expect(geoTrafficTab("agents")).toBeNull();
    expect(geoTrafficTab("WEB")).toBeNull();
    expect(geoTrafficTab("foo")).toBeNull();
  });
});
