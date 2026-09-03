import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { DURATION, EASE } from "./motion";

const motionCss = readFileSync(
  new URL("../styles/motion.css", import.meta.url),
  "utf8"
);

function readCustomProperty(name: string): string {
  const value = motionCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];
  assert.ok(value, `Missing --${name} in motion.css`);
  return value.trim();
}

describe("motion tokens", () => {
  test("keeps CSS durations synchronized with TypeScript", () => {
    for (const [name, seconds] of Object.entries(DURATION)) {
      assert.equal(
        readCustomProperty(`transition-duration-${name}`),
        `${seconds * 1000}ms`
      );
    }
  });

  test("keeps CSS easings synchronized with TypeScript", () => {
    for (const [name, points] of Object.entries(EASE)) {
      if (name === "out") {
        continue;
      }

      const cssName = name.replace(
        /[A-Z]/g,
        (letter) => `-${letter.toLowerCase()}`
      );
      assert.equal(
        readCustomProperty(`ease-${cssName}`),
        `cubic-bezier(${points.join(", ")})`
      );
    }
  });
});
