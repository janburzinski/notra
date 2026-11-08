import { expect, test } from "bun:test";

import { scrubWebUtmText } from "../src/utils/web-utm";

test("UTM text stays as written unless it identifies someone, and is capped", () => {
  expect(scrubWebUtmText(" Spring_2026 ")).toBe("Spring_2026");
  expect(scrubWebUtmText("hero-button-v2")).toBe("hero-button-v2");
  expect(scrubWebUtmText(null)).toBe("");
  for (const value of [
    "jane@example.com",
    "jane%40example.com",
    "550e8400-e29b-41d4-a716-446655440000",
    "u_8fK2qLm9Xz4RtV1pQw7",
  ]) {
    expect(scrubWebUtmText(value)).toBe(":id");
  }
  expect(scrubWebUtmText("a ".repeat(200))).toHaveLength(200);
});
