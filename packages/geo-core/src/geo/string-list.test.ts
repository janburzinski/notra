import { describe, expect, test } from "bun:test";

import { addUniqueValues } from "./string-list";

describe("addUniqueValues", () => {
  test("preserves first-seen order and compares without case", () => {
    expect(
      JSON.stringify(addUniqueValues(["Alpha"], " beta\nALPHA\nGamma\nbeta "))
    ).toBe(JSON.stringify(["Alpha", "beta", "Gamma"]));
  });

  test("stops at the limit", () => {
    expect(JSON.stringify(addUniqueValues(["Alpha"], "Beta\nGamma", 2))).toBe(
      JSON.stringify(["Alpha", "Beta"])
    );
  });

  test("returns the original array when nothing is added", () => {
    const values = ["Alpha"];
    expect(addUniqueValues(values, " alpha\n\n", 5)).toBe(values);
    expect(addUniqueValues(values, "Beta", 1)).toBe(values);
  });
});
