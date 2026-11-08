import { expect, test } from "bun:test";

import { lookupCountry } from "../src/utils/country";

test("resolves public IPv4 and IPv6 addresses to ISO countries in process", () => {
  expect(lookupCountry("8.8.8.8")).toBe("US");
  expect(lookupCountry("85.214.132.117")).toBe("DE");
  expect(lookupCountry("2a00:1450:4001:80b::200e")).toBe("DE");
});

test("returns nothing for private, loopback and malformed addresses", () => {
  for (const ip of ["127.0.0.1", "10.0.0.8", "::1", "not-an-ip", ""]) {
    expect(lookupCountry(ip)).toBeUndefined();
  }
});
