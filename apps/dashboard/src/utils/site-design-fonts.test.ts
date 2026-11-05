import { expect, test } from "bun:test";

import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import { patchDesign, readDesignForm } from "./site-design";

const faces = [
  { source: "/fonts/display-300.woff2", weight: 300 },
  { source: "/fonts/display-italic.woff2", style: "italic" },
];

test("editing a font keeps its extra faces from blog.json", () => {
  const config = {
    name: "Acme",
    fonts: {
      heading: { family: "Acme Display", weight: 500, faces },
      body: { family: "Inter" },
    },
  };
  const initial = readDesignForm(config);
  const saved = patchDesign(
    config,
    { ...initial, heading: { ...initial.heading, weight: "600" } },
    initial
  );
  expect(saved.fonts).toEqual({
    heading: { family: "Acme Display", weight: 600, faces },
    body: { family: "Inter" },
  });
  expect(siteConfigSchema.safeParse(saved).success).toBe(true);
});

test("a single font keeps its faces, and a new family drops them", () => {
  const config = {
    name: "Acme",
    fonts: { family: "Acme Display", source: "/fonts/display.woff2", faces },
  };
  const initial = readDesignForm(config);
  expect(
    patchDesign(
      config,
      { ...initial, font: { ...initial.font, weight: "500" } },
      initial
    ).fonts
  ).toEqual({
    family: "Acme Display",
    weight: 500,
    source: "/fonts/display.woff2",
    format: "woff2",
    faces,
  });
  expect(
    patchDesign(
      config,
      { ...initial, font: { ...initial.font, family: "Inter", source: "" } },
      initial
    ).fonts
  ).toEqual({ family: "Inter" });
});
