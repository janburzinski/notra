import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

import {
  brandSettings,
  geoCompetitors,
  geoPrompts,
  organizations,
} from "@notra/db/schema";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { GeoEntitlementService, GeoWorkflowService } from "../src/deps";
import type {
  GeoEntitlementServiceShape,
  GeoWorkflowServiceShape,
} from "../src/types/deps";
import {
  database,
  initializeDatabase,
  resetDatabase,
  settingsFor,
  testDb,
} from "./utils/database";
import "./utils/infrastructure";

mock.module("@notra/ai/utils/redis", () => ({ redis: null }));
const actualContextDev = await import("@notra/ai/utils/context-dev");
mock.module("@notra/ai/utils/context-dev", () => ({
  ...actualContextDev,
  scrapeWebsiteForBrandAnalysis: async () => ({
    success: true,
    content: "Acme sends transactional email for developers.",
  }),
}));
const actualAi = await import("ai");
mock.module("ai", () => ({
  ...actualAi,
  generateText: async () => ({
    output: {
      companyName: "Acme",
      aliases: ["acme.dev"],
      audienceType: "technical",
      competitors: [{ name: "Postmark", domain: "postmarkapp.com" }],
      prompts: [
        {
          prompt: "best transactional email api for a small saas",
          title: "Best transactional email APIs",
        },
      ],
      conversations: [],
    },
  }),
}));

const { createGeoProjectFromWebsite } = await import("../src/geo/discover");

const startGeoScanRun = mock<GeoWorkflowServiceShape["startGeoScanRun"]>(() =>
  Effect.succeed({ runId: "workflow-test" })
);
const workflows: GeoWorkflowServiceShape = {
  startGeoScanRun,
  startGeoWriterRun: () => Effect.die("Unexpected writer workflow"),
  startAgentReadinessRun: () => Effect.die("Unexpected readiness workflow"),
};
const entitlements: GeoEntitlementServiceShape = {
  resolveZdrEntitlement: () => Effect.succeed("unknown"),
  checkScanBilling: () =>
    Effect.succeed({
      allowed: true,
      mode: "unmetered",
      featureId: null,
      reserved: false,
      lockId: null,
      useMarkup: false,
    }),
};

const ORGANIZATION_ID = "org-create";
const BRAND_ID = "brand-create";

const create = (startScan: boolean) =>
  Effect.runPromise(
    createGeoProjectFromWebsite(
      ORGANIZATION_ID,
      "Acme",
      BRAND_ID,
      "https://acme.dev",
      startScan,
      undefined,
      startScan
    ).pipe(
      Effect.provideService(GeoWorkflowService, workflows),
      Effect.provideService(GeoEntitlementService, entitlements)
    )
  );

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(async () => {
  await resetDatabase();
  startGeoScanRun.mockClear();
  await testDb.insert(organizations).values({
    id: ORGANIZATION_ID,
    name: ORGANIZATION_ID,
    slug: ORGANIZATION_ID,
    createdAt: new Date(),
  });
  await testDb.insert(brandSettings).values({
    id: BRAND_ID,
    organizationId: ORGANIZATION_ID,
    name: "Acme",
    websiteUrl: "https://acme.dev",
  });
});

test("seeds a project without scanning or arming the sweep when scans are off", async () => {
  const project = await create(false);

  const settings = await settingsFor(project.id);
  expect(settings?.companyName).toBe("Acme");
  expect(settings?.enabled).toBe(false);
  expect(settings?.nextScanAt).toBeNull();
  expect(startGeoScanRun).not.toHaveBeenCalled();

  const prompts = await testDb
    .select({ prompt: geoPrompts.prompt })
    .from(geoPrompts)
    .where(eq(geoPrompts.projectId, project.id));
  expect(prompts.map((row) => row.prompt)).toEqual([
    "best transactional email api for a small saas",
  ]);
  const competitors = await testDb
    .select({ name: geoCompetitors.name })
    .from(geoCompetitors)
    .where(eq(geoCompetitors.projectId, project.id));
  expect(competitors.map((row) => row.name)).toEqual(["Postmark"]);
});

test("enables tracking and starts the first scan when asked", async () => {
  const project = await create(true);

  expect((await settingsFor(project.id))?.enabled).toBe(true);
  expect(startGeoScanRun).toHaveBeenCalledTimes(1);
});
