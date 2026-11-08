import { afterAll, beforeAll, expect, test } from "bun:test";

const previousSecret = process.env.GEO_INGEST_SECRET;
beforeAll(() => {
  process.env.GEO_INGEST_SECRET = "web-key-test-secret";
});
afterAll(() => {
  process.env.GEO_INGEST_SECRET = previousSecret;
});

const { buildGeoWebKey, verifyGeoWebKey, verifyGeoIngestToken } =
  await import("../src/geo/ingest");

const keyOf = (generation?: number, projectId = "proj_1") =>
  buildGeoWebKey("org_1", projectId, generation) ?? "";
const signatureOf = (key: string) => key.split(".").at(-1) ?? "";

test("a project key round-trips to a web identity; rotated keys carry their generation", () => {
  expect(keyOf()).toMatch(/^nwk\.org_1\.proj_1\.[0-9a-f]{32}$/);
  expect(keyOf(0)).toBe(keyOf());
  expect(verifyGeoWebKey(keyOf())).toEqual({
    organizationId: "org_1",
    projectId: "proj_1",
    generation: 0,
    web: true,
  });
  expect(keyOf(3)).toMatch(/^nwk\.org_1\.proj_1\.g3\.[0-9a-f]{32}$/);
  expect(verifyGeoWebKey(keyOf(3))).toMatchObject({
    projectId: "proj_1",
    generation: 3,
  });
});

test("unscoped, tampered, re-scoped, re-generated and foreign keys are rejected", () => {
  const key = keyOf();
  const signature = signatureOf(key);
  const rotatedSignature = signatureOf(keyOf(2));
  expect(keyOf(0, "")).toStartWith("nwk.org_1..");
  for (const candidate of [
    keyOf(0, ""),
    keyOf(2, ""),
    `${key.slice(0, -1)}0`,
    `nwk.org_2.proj_1.${signature}`,
    `nwk.org_1.${signature}`,
    `nwk.org_1.proj_1.extra.${signature}`,
    `nwk.org_1.proj_1.g2.${signature}`,
    `nwk.org_1.proj_1.g3.${rotatedSignature}`,
    `nwk.org_1.proj_1.gx.${rotatedSignature}`,
    `nwk.org_1.proj_1.g0.${rotatedSignature}`,
    key.replace("nwk.", "nst."),
    "nwk.",
    "",
  ]) {
    expect(verifyGeoWebKey(candidate)).toBeNull();
  }
});

test("a public key cannot be used as a write token", () => {
  expect(verifyGeoIngestToken(keyOf())).toBeNull();
  expect(verifyGeoIngestToken(keyOf().slice("nwk.".length))).toBeNull();
});
