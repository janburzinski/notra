import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";

import {
  brandSettings,
  geoCompetitors,
  geoProducts,
  geoPrompts,
  organizations,
} from "@notra/db/schema";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";

import { GEO_PRODUCTS_MAX } from "../src/constants/geo";
import {
  GeoCodingAgentAccessService,
  GeoEntitlementService,
  GeoWorkflowService,
} from "../src/deps";
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
let sortOutput: {
  prompts: { index: number; product: string | null; intent: string | null }[];
} = { prompts: [] };
mock.module("ai", () => ({
  ...actualAi,
  generateText: async (options: {
    providerOptions?: { gateway?: { tags?: string[] } };
  }) =>
    options.providerOptions?.gateway?.tags?.includes("geo-product-sort")
      ? { output: sortOutput }
      : discoveryResult(),
}));

/** Products discovery returns besides the main one. */
let extraProducts: { name: string; niche: string }[] = [];

const discoveryResult = () => ({
  output: {
    companyName: "Acme",
    aliases: ["acme.dev"],
    audienceType: "technical",
    competitors: [{ name: "Postmark", domain: "postmarkapp.com" }],
    products: [
      { name: "Acme Email", niche: "Developers sending app email" },
      ...extraProducts,
    ],
    prompts: [
      {
        prompt: "best transactional email api for a small saas",
        title: "Best transactional email APIs",
        product: "Acme Email",
        intent: "list",
      },
    ],
    conversations: [],
  },
});

const { createGeoProjectFromWebsite, generateGeoFromWebsite } =
  await import("../src/geo/discover");

const startGeoScanRun = mock<GeoWorkflowServiceShape["startGeoScanRun"]>(() =>
  Effect.succeed({ runId: "workflow-test" })
);
const workflows: GeoWorkflowServiceShape = {
  startGeoScanRun,
  startGeoWriterRun: () => Effect.die("Unexpected writer workflow"),
  startAgentReadinessRun: () => Effect.succeed({ runId: "readiness-test" }),
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
      Effect.provideService(GeoEntitlementService, entitlements),
      Effect.provideService(GeoCodingAgentAccessService, {
        hasPaidPlanForOrganization: () => Effect.succeed(true),
      })
    )
  );

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(async () => {
  await resetDatabase();
  startGeoScanRun.mockClear();
  sortOutput = { prompts: [] };
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

test("links a saved prompt to its product when setup runs again", async () => {
  const project = await create(false);
  await testDb
    .update(geoPrompts)
    .set({ productId: null, intent: null })
    .where(eq(geoPrompts.projectId, project.id));

  await Effect.runPromise(
    generateGeoFromWebsite(
      { organizationId: ORGANIZATION_ID, projectId: project.id },
      "https://acme.dev"
    ).pipe(
      Effect.provideService(GeoWorkflowService, workflows),
      Effect.provideService(GeoEntitlementService, entitlements),
      Effect.provideService(GeoCodingAgentAccessService, {
        hasPaidPlanForOrganization: () => Effect.succeed(true),
      })
    )
  );

  const products = await testDb
    .select({ id: geoProducts.id, name: geoProducts.name })
    .from(geoProducts)
    .where(eq(geoProducts.projectId, project.id));
  expect(products.map((row) => row.name)).toEqual(["Acme Email"]);
  const prompts = await testDb
    .select({ productId: geoPrompts.productId, intent: geoPrompts.intent })
    .from(geoPrompts)
    .where(eq(geoPrompts.projectId, project.id));
  expect(prompts).toEqual([
    { productId: products[0]?.id ?? "", intent: "list" },
  ]);
});

test("sorts prompts saved before products existed into a product", async () => {
  const project = await create(false);
  await testDb.insert(geoPrompts).values([
    {
      id: "manual-email",
      organizationId: ORGANIZATION_ID,
      projectId: project.id,
      prompt: "how do i stop my password reset emails landing in spam",
    },
    {
      id: "manual-general",
      organizationId: ORGANIZATION_ID,
      projectId: project.id,
      prompt: "who are good startups based in berlin",
    },
  ]);
  sortOutput = {
    prompts: [
      { index: 0, product: "acme email", intent: "problem" },
      { index: 1, product: null, intent: null },
    ],
  };

  await Effect.runPromise(
    generateGeoFromWebsite(
      { organizationId: ORGANIZATION_ID, projectId: project.id },
      "https://acme.dev"
    ).pipe(
      Effect.provideService(GeoWorkflowService, workflows),
      Effect.provideService(GeoEntitlementService, entitlements),
      Effect.provideService(GeoCodingAgentAccessService, {
        hasPaidPlanForOrganization: () => Effect.succeed(true),
      })
    )
  );

  const [product] = await testDb
    .select({ id: geoProducts.id })
    .from(geoProducts)
    .where(eq(geoProducts.projectId, project.id));
  const rows = await testDb
    .select({
      id: geoPrompts.id,
      productId: geoPrompts.productId,
      intent: geoPrompts.intent,
    })
    .from(geoPrompts)
    .where(inArray(geoPrompts.id, ["manual-email", "manual-general"]))
    .orderBy(geoPrompts.id);
  expect(rows).toEqual([
    { id: "manual-email", productId: product?.id ?? "", intent: "problem" },
    { id: "manual-general", productId: null, intent: null },
  ]);
});

test("enables tracking and starts the first scan when asked", async () => {
  const project = await create(true);

  expect((await settingsFor(project.id))?.enabled).toBe(true);
  expect(startGeoScanRun).toHaveBeenCalledTimes(1);
});

test("running setup again never takes a project past the product limit", async () => {
  const project = await create(false);
  await testDb.insert(geoProducts).values(
    Array.from({ length: GEO_PRODUCTS_MAX - 1 }, (_, index) => ({
      id: `full-${index}`,
      organizationId: ORGANIZATION_ID,
      projectId: project.id,
      name: `Product ${index}`,
      position: index + 1,
    }))
  );
  extraProducts = [{ name: "Acme SMS", niche: "Teams sending login codes" }];

  try {
    await Effect.runPromise(
      generateGeoFromWebsite(
        { organizationId: ORGANIZATION_ID, projectId: project.id },
        "https://acme.dev"
      ).pipe(
        Effect.provideService(GeoWorkflowService, workflows),
        Effect.provideService(GeoEntitlementService, entitlements),
        Effect.provideService(GeoCodingAgentAccessService, {
          hasPaidPlanForOrganization: () => Effect.succeed(true),
        })
      )
    );
  } finally {
    extraProducts = [];
  }

  const names = await testDb
    .select({ name: geoProducts.name })
    .from(geoProducts)
    .where(eq(geoProducts.projectId, project.id));
  expect(names).toHaveLength(GEO_PRODUCTS_MAX);
  expect(names.map((row) => row.name)).not.toContain("Acme SMS");
});

test("running setup again does not bring back a product someone deleted", async () => {
  const project = await create(false);
  const [product] = await testDb
    .select({ id: geoProducts.id })
    .from(geoProducts)
    .where(eq(geoProducts.projectId, project.id));
  const { deleteGeoProduct } = await import("../src/geo/programs");
  await Effect.runPromise(
    deleteGeoProduct({
      organizationId: ORGANIZATION_ID,
      projectId: project.id,
      productId: product?.id ?? "",
    })
  );

  await Effect.runPromise(
    generateGeoFromWebsite(
      { organizationId: ORGANIZATION_ID, projectId: project.id },
      "https://acme.dev"
    ).pipe(
      Effect.provideService(GeoWorkflowService, workflows),
      Effect.provideService(GeoEntitlementService, entitlements),
      Effect.provideService(GeoCodingAgentAccessService, {
        hasPaidPlanForOrganization: () => Effect.succeed(true),
      })
    )
  );

  const names = await testDb
    .select({ name: geoProducts.name })
    .from(geoProducts)
    .where(eq(geoProducts.projectId, project.id));
  expect(names).toEqual([]);
});
