import { expect, mock, test } from "bun:test";

import { Effect } from "effect";

const importRows = [
  {
    id: "imp_1",
    organizationId: "org_1",
    projectId: "proj_1",
    connectionId: "aic_secret_connection",
    provider: "plausible",
    kind: "web",
    externalSiteRef: "acme.com",
    externalSiteLabel: null,
    host: "acme.com",
    status: "completed",
    effectiveStartDay: "2025-01-01",
    effectiveEndDay: "2026-09-30",
    cutoffDay: "2026-10-01",
    chunksTotal: 2,
    chunksDone: 2,
    pageviewsImported: 10,
    rowsWritten: 4,
    capabilities: {
      visitors: true,
      visits: true,
      bounces: true,
      utm: false,
      entryPages: false,
      sampled: false,
    },
    lastError: null,
    retryAt: null,
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    completedAt: new Date("2026-11-01T10:05:00.000Z"),
    uploadKey: "uploads/secret.zip",
  },
];

mock.module("@notra/db/drizzle", () => ({
  db: {
    query: {
      analyticsImports: { findMany: async () => importRows },
    },
  },
}));

const { listAnalyticsImportSummaries } =
  await import("../src/geo/analytics-imports");

test("import summaries report progress without connections or uploads", async () => {
  const [summary] = await Effect.runPromise(
    listAnalyticsImportSummaries("org_1", "proj_1")
  );
  expect(summary).toMatchObject({
    id: "imp_1",
    sourceLabel: "acme.com",
    status: "completed",
    completedAt: "2026-11-01T10:05:00.000Z",
  });
  expect(JSON.stringify(summary)).not.toContain("secret");
});
