import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  analyticsImportConnections,
  analyticsImports,
  brandSettings,
  organizations,
  projects,
  users,
} from "@notra/db/schema";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { FatalError } from "workflow";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";
import {
  createFakeDataset,
  expectedWebTotals,
  routeProviderFetch,
  startFakeProviders,
} from "./utils/fake-import-providers";

/**
 * History imports end to end: the oRPC procedures, the durable workflow with
 * its real steps and the providers' HTTP APIs (in-process fakes reached over
 * real HTTP). Only Tinybird is captured in memory.
 */
if (process.env.NOTRA_ANALYTICS_IMPORTS_E2E !== "1") {
  test("analytics imports end to end on migrated sandbox PostgreSQL", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_ANALYTICS_IMPORTS_E2E: "1",
          DATABASE_URL: "",
          INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        },
        timeout: 170_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 180_000);
} else {
  const DAY_MS = 86_400_000;
  const day = (offset: number) =>
    new Date(Date.now() + offset * DAY_MS).toISOString().slice(0, 10);
  const HOST = "example.com";
  const DATA_START = day(-125);
  const sandbox = await createAutopilotSandbox();
  const db = sandbox.db;
  const webRows: Record<string, unknown>[] = [];
  const geoRows: Record<string, unknown>[] = [];
  const sleeps: string[] = [];
  let nativeFirstDay = "1970-01-01";
  let importsAllowed = true;
  mock.module("@notra/db/drizzle", () => ({ db }));
  mock.module("@notra/ai/utils/web-analytics-access", () => ({
    isWebAnalyticsEnabledForOrganization: async () => true,
    resolveWebAnalyticsFlagState: async () => "enabled" as const,
    webAnalyticsFlagState: () => Effect.succeed("enabled" as const),
  }));
  const client = await import("@notra/analytics/tinybird/client");
  const purge = await import("@notra/analytics/tinybird/purge");
  const queryCache = await import("@notra/analytics/cache/query-cache");
  mock.module("@notra/analytics/tinybird/client", () => ({
    ...client,
    ingestWebImportedDaily: async (rows: Record<string, unknown>[]) => {
      webRows.push(...rows);
      return { successful_rows: rows.length, quarantined_rows: 0 };
    },
    ingestGeoImportedDaily: async (rows: Record<string, unknown>[]) => {
      geoRows.push(...rows);
      return { successful_rows: rows.length, quarantined_rows: 0 };
    },
    queryWebNativeFirstDay: async () => ({
      data: [{ web_first_day: nativeFirstDay, geo_first_day: nativeFirstDay }],
    }),
  }));
  mock.module("@notra/analytics/tinybird/purge", () => ({
    ...purge,
    purgeImportedRows: async (input: {
      importId: string;
      fromDay?: string;
      toDay?: string;
    }) => {
      for (const rows of [webRows, geoRows]) {
        const kept = rows.filter(
          (row) =>
            row.import_id !== input.importId ||
            (input.fromDay &&
              input.toDay &&
              (String(row.day) < input.fromDay ||
                String(row.day) > input.toDay))
        );
        rows.splice(0, rows.length, ...kept);
      }
    },
  }));
  mock.module("@notra/analytics/cache/query-cache", () => ({
    ...queryCache,
    bumpAnalyticsVersions: async () => undefined,
  }));
  mock.module("../src/lib/auth/organization", () => ({
    assertAuthenticated: async () => ({ session: {}, user: { id: "user-a" } }),
    assertOrganizationAccess: async () => ({
      organizationId: "org-a",
      membership: { role: "owner" },
      user: { id: "user-a" },
    }),
  }));
  const subscription = await import("../src/lib/billing/subscription");
  mock.module("../src/lib/billing/subscription", () => ({
    ...subscription,
    assertGeoEntitlement: async () => undefined,
  }));
  const limits = await import("../src/utils/ratelimit");
  const limitCalls: string[] = [];
  mock.module("../src/utils/ratelimit", () => ({
    ...limits,
    ratelimit: {
      ...limits.ratelimit,
      analyticsImport: {
        limit: async (key: string) => {
          limitCalls.push(key);
          return { success: importsAllowed };
        },
      },
    },
  }));
  mock.module("workflow", () => ({
    FatalError,
    // Durable sleeps return at once, after a tick so queued runs poll gently.
    sleep: async (duration: string) => {
      sleeps.push(duration);
      await new Promise((resolve) => setTimeout(resolve, 2));
    },
  }));
  mock.module("../src/lib/analytics-imports/runs", () => ({
    readImportRunState: async () => "running",
    wakeImportRun: async () => undefined,
  }));
  mock.module("../src/workflows/runtime", () => ({}));
  // Started runs wait until the test lets them go, so faults set up after
  // the preview and create calls reach the workflow and nothing earlier.
  const runs = new Map<string, () => Promise<unknown>>();
  mock.module("../src/lib/workflows/start", () => ({
    startAnalyticsImportRun: async ({ importId }: { importId: string }) => {
      const workflows = await import("../src/workflows/analytics-import");
      runs.set(importId, () =>
        workflows
          .analyticsImportWorkflow({ importId })
          .catch((error: unknown) => error)
      );
      return { runId: `run_${importId}` };
    },
    startAnalyticsImportDeleteRun: async () => ({ runId: "delete" }),
  }));

  const dataset = createFakeDataset({
    host: HOST,
    start: DATA_START,
    end: day(-1),
  });
  const fakes = await startFakeProviders({
    dataset,
    host: HOST,
    plausibleKey: "plausible-stats-key-1",
    cloudflareToken: "cloudflare-analytics-read-token-1",
    zoneId: "zone123",
    cloudflareSampleInterval: 2,
    crawlerNotOlderThan: 8 * 86_400,
  });
  globalThis.fetch = routeProviderFetch(fakes, fetch);

  const { analyticsImportsRouter } =
    await import("../src/lib/orpc/routers/analytics-imports");
  const { createORPCContext } = await import("../src/lib/orpc/context");
  const context = () => createORPCContext({ headers: new Headers() });

  const orgInput = { organizationId: "org-a" };
  const loadImport = async (importId: string) =>
    await db.query.analyticsImports.findFirst({
      where: eq(analyticsImports.id, importId),
    });

  const connect = async (
    provider: "plausible" | "cloudflare",
    secret: string,
    extra: { connectionId?: string } = {}
  ) =>
    await call(
      analyticsImportsRouter.connect,
      { ...orgInput, provider, secret, ...extra },
      { context: await context() }
    );
  const connectPlausible = async () =>
    (await connect("plausible", "plausible-stats-key-1")).connection;

  const startImport = async (input: {
    connectionId: string;
    provider: "plausible" | "cloudflare";
    sourceRef: string;
  }) => {
    const source = {
      ...orgInput,
      sourceLabel: HOST,
      ...input,
      projectId: "project-a",
      host: HOST,
    };
    const { preview } = await call(analyticsImportsRouter.preview, source, {
      context: await context(),
    });
    const { import: created } = await call(
      analyticsImportsRouter.create,
      source,
      { context: await context() }
    );
    return { preview, importId: created.id };
  };
  const startPlausibleImport = (connectionId: string) =>
    startImport({ connectionId, provider: "plausible", sourceRef: HOST });

  const finish = async (importId: string) => {
    const outcome = await runs.get(importId)?.();
    return { outcome, row: await loadImport(importId) };
  };

  const writtenTotals = (importId: string) => {
    const totals = webRows.filter(
      (row) => row.import_id === importId && row.grain === "total"
    );
    const days = totals.map((row) => String(row.day)).toSorted();
    return {
      pageviews: totals.reduce((sum, row) => sum + Number(row.pageviews), 0),
      visits: totals.reduce((sum, row) => sum + Number(row.visits ?? 0), 0),
      visitors: totals.reduce((sum, row) => sum + Number(row.visitors ?? 0), 0),
      days: new Set(days).size,
      firstDay: days[0],
      lastDay: days.at(-1),
    };
  };

  beforeAll(async () => {
    await db.insert(organizations).values({
      id: "org-a",
      name: "Acme",
      slug: "acme",
      createdAt: new Date(),
    });
    await db
      .insert(users)
      .values({ id: "user-a", name: "Ada", email: "ada@example.test" });
    await db.insert(brandSettings).values({
      id: "brand-a",
      organizationId: "org-a",
      websiteUrl: `https://${HOST}`,
    });
    await db.insert(projects).values({
      id: "project-a",
      organizationId: "org-a",
      name: "Main",
      brandSettingsId: "brand-a",
    });
  });
  afterAll(async () => {
    fakes.stop();
    await sandbox.postgres.close();
  });
  beforeEach(async () => {
    await db.delete(analyticsImports);
    await db.delete(analyticsImportConnections);
    webRows.length = 0;
    geoRows.length = 0;
    sleeps.length = 0;
    limitCalls.length = 0;
    runs.clear();
    nativeFirstDay = "1970-01-01";
    importsAllowed = true;
    fakes.faults.plausible429 = 0;
    fakes.faults.beforeRequest = undefined;
    fakes.options.plausibleKey = "plausible-stats-key-1";
  });

  describe("Plausible Stats API", () => {
    beforeEach(() => {
      nativeFirstDay = day(-20);
    });

    test("imports months of history exactly once, sleeping through a rate limit", async () => {
      const { connection } = await connect(
        "plausible",
        "plausible-stats-key-1"
      );
      expect(JSON.stringify(connection)).not.toContain("plausible-stats-key-1");
      const stored = await db.query.analyticsImportConnections.findFirst();
      expect(stored?.encryptedCredentials).not.toContain(
        "plausible-stats-key-1"
      );

      fakes.faults.plausible429 = 1;
      await expect(startPlausibleImport(connection.id)).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      const { preview, importId } = await startPlausibleImport(connection.id);
      expect(preview).toMatchObject({
        startDay: `${DATA_START.slice(0, 7)}-01`,
        endDay: day(-21),
        cutoffDay: day(-20),
        clipped: false,
      });
      expect(preview.months).toBeGreaterThanOrEqual(4);

      // The workflow sleeps through a rate limit mid-import.
      fakes.faults.plausible429 = 1;
      const { outcome, row } = await finish(importId);
      expect(outcome).toMatchObject({ status: "completed" });
      expect(sleeps).toEqual(["60s"]);
      expect(row).toMatchObject({
        status: "completed",
        chunksDone: preview.months,
        chunksTotal: preview.months,
      });

      const expected = expectedWebTotals(dataset, {
        start: DATA_START,
        end: day(-21),
      });
      expect(writtenTotals(importId)).toMatchObject({
        pageviews: expected.pageviews,
        visits: expected.visits,
        visitors: expected.visitors,
        days: expected.days,
        firstDay: DATA_START,
        lastDay: day(-21),
      });
      expect(row?.pageviewsImported).toBe(expected.pageviews);
      // The preview estimates the imported days from monthly totals.
      expect(
        Math.abs((preview.pageviews ?? 0) - expected.pageviews)
      ).toBeLessThanOrEqual(expected.pageviews * 0.15);
    }, 60_000);

    test("a revoked key fails the import, removes its rows and asks for a reconnect", async () => {
      const connection = await connectPlausible();
      const { importId } = await startPlausibleImport(connection.id);
      let served = 0;
      fakes.faults.beforeRequest = () => {
        served += 1;
        if (served === 12) {
          fakes.options.plausibleKey = "rotated-plausible-key";
        }
      };
      const { outcome, row } = await finish(importId);
      expect(outcome).toBeInstanceOf(FatalError);
      expect(row?.status).toBe("failed");
      expect(row?.lastError).toContain("plausible rejected the credentials");
      expect(webRows.filter((item) => item.import_id === importId)).toEqual([]);
      const flagged = await db.query.analyticsImportConnections.findFirst();
      expect(flagged).toMatchObject({ status: "reauth_required" });

      const reconnected = await connect("plausible", "rotated-plausible-key", {
        connectionId: connection.id,
      });
      expect(reconnected.connection).toMatchObject({
        id: connection.id,
        status: "active",
        lastError: null,
      });
      expect(await db.query.analyticsImportConnections.findMany()).toHaveLength(
        1
      );
    }, 60_000);

    test("a connection only reads its own provider, and connecting and uploads are rate limited per organization", async () => {
      const connection = await connectPlausible();
      expect(limitCalls).toEqual(["connect:org-a"]);
      await expect(
        startImport({
          connectionId: connection.id,
          provider: "cloudflare",
          sourceRef: "zone123",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        connect("cloudflare", "cloudflare-analytics-read-token-1", {
          connectionId: connection.id,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      importsAllowed = false;
      await expect(connectPlausible()).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      await expect(
        call(
          analyticsImportsRouter.uploadTarget,
          { ...orgInput, fileSize: 1024 },
          { context: await context() }
        )
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    });
  });

  test("Cloudflare imports AI crawler hits for the days the plan keeps, sampled and with humans and scanners dropped", async () => {
    const { connection } = await connect(
      "cloudflare",
      "cloudflare-analytics-read-token-1"
    );
    const { preview, importId } = await startImport({
      connectionId: connection.id,
      provider: "cloudflare",
      sourceRef: "zone123",
    });
    expect(preview).toMatchObject({ kind: "geo", endDay: day(-1) });
    expect(String(preview.startDay) >= day(-8)).toBe(true);

    const { outcome, row } = await finish(importId);
    expect(outcome).toMatchObject({ status: "completed" });
    const crawlers = ["GPTBot", "ClaudeBot", "PerplexityBot"];
    const expectedHits = dataset.crawlerHits.filter(
      (hit) =>
        hit.day >= String(preview.startDay) &&
        hit.day <= day(-1) &&
        hit.path !== "/wp-login.php" &&
        crawlers.some((name) => hit.userAgent.includes(name))
    );
    const written = geoRows.filter((item) => item.import_id === importId);
    expect(written.reduce((sum, item) => sum + Number(item.requests), 0)).toBe(
      expectedHits.reduce((sum, hit) => sum + hit.count, 0)
    );
    expect(new Set(written.map((item) => item.agent))).toEqual(
      new Set(
        expectedHits.map(
          (hit) => crawlers.find((name) => hit.userAgent.includes(name)) ?? ""
        )
      )
    );
    expect(written.every((item) => item.sample_interval === 2)).toBe(true);
    expect(JSON.stringify(written)).not.toContain("Mozilla");
    expect(row?.capabilities.sampled).toBe(true);
  }, 60_000);
}
