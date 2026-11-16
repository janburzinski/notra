import "./utils/infrastructure";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  mock,
  test,
} from "bun:test";

import {
  geoContentBriefs,
  geoMentionChecks,
  geoPrompts,
  geoScans,
  postCollections,
  posts,
} from "@notra/db/schema";
import { Effect } from "effect";

import { GeoEntitlementService, GeoWorkflowService } from "../src/deps";
import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  testDb,
} from "./utils/database";

const startGeoScanScoped = mock(
  (_scope: unknown, _promptIds?: readonly string[]) =>
    Effect.succeed({ scanId: "rescan-1" })
);
mock.module("../src/geo/programs", () => ({ startGeoScanScoped }));

const { refreshGeoContentGaps } = await import("../src/geo/gaps");
const { requestGeoRescanForPost } = await import("../src/geo/rescan");

const scope = { organizationId: "org-test", projectId: "acme" };
const QUERY = "crm for startups";

beforeAll(initializeDatabase, 30_000);
afterAll(() => database.postgres.close());
beforeEach(resetDatabase);
afterEach(() => startGeoScanScoped.mockClear());

/** One first-turn answer that ran QUERY, for a prompt on one engine. */
function check(promptId: string, engine: string, mentioned: boolean) {
  return {
    id: `${promptId}-${engine}`,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    scanId: "scan-1",
    engine,
    promptId,
    prompt: `prompt ${promptId}`,
    answer: "",
    mentioned,
    competitors: ["Rival"],
    grounding: { queries: [QUERY], sources: [] },
    sources: [],
    capturedAt: new Date(),
  };
}

async function seedSearches() {
  await seedProject(scope.projectId);
  await testDb.insert(geoPrompts).values({
    id: "prompt-custom",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    prompt: "prompt custom",
  });
  await testDb.insert(geoScans).values({
    id: "scan-1",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    status: "completed",
  });
  await testDb
    .insert(geoMentionChecks)
    .values([
      check("best-crm", "chatgpt", false),
      check("best-crm", "perplexity", false),
      check("best-crm", "gemini", false),
      check("custom-prompt-custom", "chatgpt", false),
      check("custom-prompt-custom", "perplexity", true),
    ]);
}

async function publishBriefFor(sourceId: string) {
  await testDb.insert(postCollections).values({
    id: "collection-1",
    organizationId: scope.organizationId,
    source: "manual",
    name: "Posts",
    nameSource: "generated",
  });
  await testDb.insert(posts).values({
    id: "post-1",
    organizationId: scope.organizationId,
    collectionId: "collection-1",
    title: "CRM for startups",
    content: "",
    contentType: "blog_post",
  });
  await testDb.insert(geoContentBriefs).values({
    id: "brief-1",
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    brandSettingsId: `brand-${scope.projectId}`,
    topic: QUERY,
    brief: {
      targetPrompt: QUERY,
      intent: "list",
      contentSubtype: "guide",
      workingTitle: "CRM for startups",
      audience: "",
      jobToBeDone: "",
      sections: [],
      questionsToAnswer: [],
      internalLinks: [],
      acceptanceChecklist: [],
    },
    status: "completed",
    sourceKind: "ai_search",
    sourceId,
    postId: "post-1",
  });
  // startGeoScanScoped is mocked, so the scan services are never reached.
  return await Effect.runPromise(
    requestGeoRescanForPost({
      organizationId: scope.organizationId,
      postId: "post-1",
    }).pipe(
      Effect.provideService(GeoWorkflowService, {
        startGeoScanRun: () => Effect.die("Unexpected scan workflow"),
        startGeoWriterRun: () => Effect.die("Unexpected writer workflow"),
        startAgentReadinessRun: () => Effect.die("Unexpected readiness run"),
      }),
      Effect.provideService(GeoEntitlementService, {
        resolveZdrEntitlement: () => Effect.die("Unexpected ZDR lookup"),
        checkScanBilling: () => Effect.die("Unexpected billing check"),
      })
    )
  );
}

test("an AI search gap names the prompts that ran it, most missed first", async () => {
  await seedSearches();
  const gaps = await Effect.runPromise(refreshGeoContentGaps(scope));
  expect(gaps.aiSearchGaps).toHaveLength(1);
  expect(gaps.aiSearchGaps[0]).toMatchObject({
    query: QUERY,
    searches: 4,
    // Custom prompt scans are keyed `custom-<id>`; the gap names the prompt.
    promptIds: ["best-crm", "prompt-custom"],
  });
});

test("an AI search gap names the page that already covers the search", async () => {
  await seedSearches();
  await testDb.insert(postCollections).values({
    id: "collection-live",
    organizationId: scope.organizationId,
    source: "manual",
    name: "Posts",
    nameSource: "generated",
  });
  await testDb.insert(posts).values({
    id: "post-live",
    organizationId: scope.organizationId,
    collectionId: "collection-live",
    title: "The best CRM for startups",
    slug: "crm-for-startups",
    htmlUrl: "https://acme.com/blog/crm-for-startups",
    content: "",
    contentType: "blog_post",
  });
  const gaps = await Effect.runPromise(refreshGeoContentGaps(scope));
  expect(gaps.aiSearchGaps[0]?.recommendation).toMatchObject({
    action: "update",
    targets: [{ url: "https://acme.com/blog/crm-for-startups" }],
  });
});

test("publishing an AI search brief rescans the prompts behind the search", async () => {
  await seedSearches();
  const gaps = await Effect.runPromise(refreshGeoContentGaps(scope));
  const gapId = gaps.aiSearchGaps[0]?.id ?? "";
  const outcome = await publishBriefFor(gapId);
  expect(outcome).toEqual({ status: "started", scanId: "rescan-1" });
  expect(startGeoScanScoped.mock.calls[0]?.[1]).toEqual([
    "best-crm",
    "prompt-custom",
  ]);
  const brief = await testDb.query.geoContentBriefs.findFirst();
  expect(brief?.rescanScanId).toBe("rescan-1");
});

test("an AI search brief whose gap is gone is not rescanned", async () => {
  await seedSearches();
  await Effect.runPromise(refreshGeoContentGaps(scope));
  const outcome = await publishBriefFor("ai-search-unknown");
  expect(outcome).toEqual({ status: "skipped", scanId: null });
  expect(startGeoScanScoped).not.toHaveBeenCalled();
});
