import { describe, expect, test } from "bun:test";

import {
  createPromptRequestSchema,
  patchPromptRequestSchema,
} from "../src/schemas/api/geo-prompts";

describe("GEO prompt requests after tags were removed", () => {
  test("reject tags instead of dropping them silently", () => {
    expect(
      patchPromptRequestSchema.safeParse({ enabled: true, tags: ["x"] }).success
    ).toBe(false);
    expect(
      createPromptRequestSchema.safeParse({
        prompt: "best app launcher for mac users",
        tags: ["x"],
      }).success
    ).toBe(false);
  });

  test("still accept the fields they support", () => {
    expect(patchPromptRequestSchema.safeParse({ enabled: false }).success).toBe(
      true
    );
    expect(
      createPromptRequestSchema.safeParse({
        prompt: "best app launcher for mac users",
      }).success
    ).toBe(true);
  });
});
