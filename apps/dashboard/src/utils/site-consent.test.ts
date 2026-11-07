import { expect, test } from "bun:test";

import { c15tConfigExample, isInthBackendUrl } from "./site-consent";

test("only *.inth.app backends count as managed by Inth", () => {
  expect(isInthBackendUrl("https://acme.inth.app")).toBe(true);
  expect(isInthBackendUrl("https://acme.inth.app/api/c15t")).toBe(true);
  expect(isInthBackendUrl("https://consent.acme.com/api/c15t")).toBe(false);
  expect(isInthBackendUrl("https://inth.app.acme.com")).toBe(false);
  expect(isInthBackendUrl("not a url")).toBe(false);
});

test("the c15t example shows every committed setting", () => {
  expect(
    JSON.parse(
      c15tConfigExample({
        backendURL: "https://consent.acme.com/api/c15t",
        crossSubdomain: true,
      })
    )
  ).toEqual({
    integrations: {
      c15t: {
        backendURL: "https://consent.acme.com/api/c15t",
        crossSubdomain: true,
      },
    },
  });
});
