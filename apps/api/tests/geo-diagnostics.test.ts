import { describe, expect, test } from "bun:test";

import { promptResultSummaryQuerySchema } from "@notra/schemas/api/geo-visibility";

import {
  decodeGeoSentimentCursor,
  encodeGeoSentimentCursor,
} from "../src/utils/geo-diagnostic-cursor";

describe("GEO diagnostic API adapters", () => {
  test("parses false as false instead of a truthy coerced string", () => {
    const query = promptResultSummaryQuerySchema.parse({ mentioned: "false" });
    expect(query.mentioned).toBe(false);
  });

  test("round-trips opaque sentiment evidence cursors", () => {
    const cursor = {
      capturedAt: "2026-09-16T00:00:00.000Z",
      id: "check-1",
      projectId: "project-1",
      scope: '["org-1","project-1",null,null,30]',
    };
    const encoded = encodeGeoSentimentCursor(cursor);

    expect(encoded).not.toContain("check-1");
    expect(decodeGeoSentimentCursor(encoded ?? undefined)).toEqual(cursor);
    expect(decodeGeoSentimentCursor("not-a-cursor")).toBeUndefined();
  });
});
