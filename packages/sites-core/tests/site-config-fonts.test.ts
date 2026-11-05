import { expect, test } from "bun:test";

import { z } from "zod";

import { siteConfigSchema } from "../src/schemas/site-config";
import { buildSiteConfigJsonSchema } from "../src/utils/site-config-json-schema";

const editorSchema = z.fromJSONSchema(buildSiteConfigJsonSchema());

function withFaces(faces: unknown) {
  return {
    name: "Acme",
    fonts: { heading: { family: "Acme Display", faces } },
  };
}

test("fonts keep their one-file shape and take faces on every role", () => {
  for (const fonts of [
    {
      family: "Acme Sans",
      weight: 400,
      source: "/fonts/acme-sans.woff2",
      format: "woff2",
      heading: { family: "Instrument Serif", weight: 400 },
    },
    { family: "Acme", faces: [{ source: "/a.woff2" }] },
    { body: { family: "Acme", faces: [{ source: "/a.woff2" }] } },
  ] satisfies z.input<typeof siteConfigSchema>["fonts"][]) {
    expect(siteConfigSchema.parse({ name: "Acme", fonts }).fonts).toEqual(
      fonts
    );
  }
});

test.each([
  [[{ source: "/fonts/display-300.woff2", weight: 300 }], true],
  [[{ source: "/fonts/display.woff2", weight: "100 900" }], true],
  [
    [{ source: "/fonts/display-italic.woff", style: "italic", format: "woff" }],
    true,
  ],
  [[], false],
  [[{ weight: 300 }], false],
  [[{ source: "/fonts/display.woff2", weight: "50 900" }], false],
  [[{ source: "/fonts/display.woff2", weight: "100-900" }], false],
  [[{ source: "/fonts/display.woff2", family: "Other" }], false],
  [
    Array.from({ length: 13 }, () => ({ source: "/fonts/display.woff2" })),
    false,
  ],
])("faces %j valid: %p, in zod and editors", (faces, valid) => {
  expect(siteConfigSchema.safeParse(withFaces(faces)).success).toBe(valid);
  expect(editorSchema.safeParse(withFaces(faces)).success).toBe(valid);
});
