import { expect, test } from "bun:test";

import { C15T_SCRIPT_CATEGORIES } from "@notra/sites-core/constants/integrations";
import { siteConfigSchema } from "@notra/sites-core/schemas/site-config";

import { siteConsent } from "../compiler/utils/consent";
import { CONSENT_OPTIONAL_CATEGORIES } from "../src/constants/consent";

const config = (crossSubdomain?: boolean) =>
  siteConfigSchema.parse({
    name: "Acme",
    integrations: {
      c15t: { backendURL: "https://consent.acme.com", crossSubdomain },
    },
  });

const storageKey = (crossSubdomain: boolean | undefined, origin: string) =>
  siteConsent(config(crossSubdomain), [], true, false, origin)?.options
    .storageConfig.storageKey;

test("HTTPS sites keep the consent choice in a host-only cookie another site can't set", () => {
  expect(storageKey(undefined, "https://acme.notra.site")).toBe("__Host-c15t");
  expect(storageKey(false, "https://blog.acme.com")).toBe("__Host-c15t");
});

test("local HTTP and cross-subdomain sharing keep c15t's default cookie", () => {
  expect(storageKey(undefined, "http://localhost:4321")).toBeUndefined();
  expect(storageKey(true, "https://blog.acme.com")).toBeUndefined();
});

test("a carried-over refusal covers every category c15t can grant", () => {
  expect([...CONSENT_OPTIONAL_CATEGORIES]).toEqual([...C15T_SCRIPT_CATEGORIES]);
});
