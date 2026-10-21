import { expect, test } from "bun:test";

import { SITE_DESIGN_SECTIONS } from "../src/constants/site-design-sections";
import {
  configValue,
  patchConfigValue,
  designIssues,
  configSectionChanged,
} from "../src/utils/site-design-sections";
import { validateVariableRows } from "../src/utils/site-variables";

test("patching design fields preserves unrelated and future config", () => {
  const config = {
    name: "Acme",
    navbar: {
      links: [{ label: "Docs", items: [{ label: "API", href: "/api" }] }],
    },
    integrations: { plausible: { domain: "acme.test" } },
    future: { kept: true },
  };
  const next = patchConfigValue(config, "seo.organization.name", "Acme Studio");
  expect(configValue(next, "seo.organization.name")).toBe("Acme Studio");
  expect(next.navbar).toEqual(config.navbar);
  expect(next.integrations).toEqual(config.integrations);
  expect(next.future).toEqual(config.future);
  expect(config).not.toHaveProperty("seo");
});
test("invalid values identify the field and cannot pass the draft validation gate", () => {
  expect(
    designIssues({ name: "Acme", colors: { primary: "#wrong" } }).map(
      (issue) => issue.path
    )
  ).toContain("colors.primary");
  expect(designIssues({ name: "" })).not.toEqual([]);
  expect(
    designIssues({
      name: "Acme",
      redirects: [
        { source: "/old", destination: ["java", "script:alert(1)"].join("") },
      ],
    })
  ).not.toEqual([]);
  expect(designIssues({ name: "Acme", layout: { width: 72 } })).toEqual([]);
});
test("section indicators compare individual fields with the published config", () => {
  const published = {
    name: "Acme",
    description: "Old",
    fonts: { family: "Inter" },
  };
  const config = { ...published, description: "New" };
  expect(
    SITE_DESIGN_SECTIONS.filter((section) =>
      configSectionChanged(config, published, section.paths)
    ).map((section) => section.id)
  ).toEqual(["general"]);
});
test("duplicate and invalid variable rows are rejected before saving", () => {
  expect(
    validateVariableRows([
      { id: "1", name: "a", value: "1" },
      { id: "2", name: "a", value: "2" },
    ]).error
  ).toBe("duplicate");
  expect(
    validateVariableRows([{ id: "1", name: "bad key", value: "1" }]).error
  ).toBe("invalid");
  expect(
    validateVariableRows([{ id: "1", name: "product", value: "Acme" }])
  ).toEqual({ variables: { product: "Acme" }, error: null });
});

test("integration fields share the config validation gate and remove whole optional providers", () => {
  const integrations = {
    ga4: { measurementId: "G-ABC123XYZ9" },
    umami: {
      websiteId: "94db1cb1-74f4-4a40-ad6c-962362670409",
      scriptUrl: "https://stats.acme.com/script.js",
      hostUrl: "https://events.acme.com",
    },
    plausible: { domain: "acme.com", server: "stats.acme.com" },
    posthog: {
      apiKey: "phc_abcdefghijklmnopqrstuvwxyz0123",
      apiHost: "https://eu.i.posthog.com",
      sessionRecording: false,
    },
  };
  expect(designIssues({ name: "Acme", integrations })).toEqual([]);
  const invalid = patchConfigValue(
    { name: "Acme", integrations },
    "integrations.ga4.measurementId",
    "wrong"
  );
  expect(designIssues(invalid).map((issue) => issue.path)).toContain(
    "integrations.ga4.measurementId"
  );
  const removed = patchConfigValue(
    { name: "Acme", integrations },
    "integrations.ga4.measurementId",
    ""
  );
  expect(configValue(removed, "integrations.ga4")).toBeUndefined();
  expect(configValue(removed, "integrations.posthog.sessionRecording")).toBe(
    false
  );
  expect(designIssues(removed)).toEqual([]);
});
