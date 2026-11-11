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
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  analyticsImportChunks,
  analyticsImports,
  brandSettings,
  organizations,
  projects,
  users,
} from "@notra/db/schema";
import { ImportRateLimitedError } from "@notra/geo-core/schemas/analytics-import-errors";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { zipSync } from "fflate";

import { createAutopilotSandbox } from "./utils/autopilot-sandbox";

if (process.env.NOTRA_ANALYTICS_IMPORTS_SANDBOX_TEST !== "1") {
  test("analytics imports on migrated sandbox PostgreSQL", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          PATH: process.env.PATH,
          NOTRA_ANALYTICS_IMPORTS_SANDBOX_TEST: "1",
          DATABASE_URL: "",
          INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        },
        timeout: 90_000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  }, 95_000);
} else {
  const sandbox = await createAutopilotSandbox();
  const db = sandbox.db;
  const webRows: Record<string, unknown>[] = [];
  const purges: Record<string, unknown>[] = [];
  let purgeFailures = 0;
  const bumps: string[] = [];
  let nativeFirstDay = "1970-01-01";
  mock.module("@notra/db/drizzle", () => ({ db }));
  const client = await import("@notra/analytics/tinybird/client");
  const purge = await import("@notra/analytics/tinybird/purge");
  const queryCache = await import("@notra/analytics/cache/query-cache");
  mock.module("@notra/analytics/tinybird/client", () => ({
    ...client,
    ingestWebImportedDaily: async (rows: Record<string, unknown>[]) => {
      webRows.push(...rows);
      return null;
    },
    ingestGeoImportedDaily: async () => null,
    queryWebNativeFirstDay: async () => ({
      data: [{ web_first_day: nativeFirstDay, geo_first_day: nativeFirstDay }],
    }),
  }));
  mock.module("@notra/analytics/tinybird/purge", () => ({
    ...purge,
    purgeImportedRows: async (input: Record<string, unknown>) => {
      if (purgeFailures > 0) {
        purgeFailures -= 1;
        throw new Error("Tinybird delete failed");
      }
      purges.push(input);
    },
  }));
  mock.module("@notra/analytics/cache/query-cache", () => ({
    ...queryCache,
    bumpAnalyticsVersions: async (_scope: string, ids: string[]) => {
      bumps.push(...ids);
    },
  }));
  // A few dozen records per chunk, so the small fixture export is imported
  // in several steps like a large one.
  const importConstants =
    await import("@notra/geo-core/constants/analytics-imports");
  mock.module("@notra/geo-core/constants/analytics-imports", () => ({
    ...importConstants,
    IMPORT_CSV_RECORDS_PER_CHUNK: 20,
  }));
  const fetchMock = mock<typeof fetch>();
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  let r2Configured = false;
  const r2Objects = new Map<string, { body: Uint8Array; modified: Date }>();
  const r2Reads: Record<string, unknown>[] = [];
  const r2 = await import("../src/lib/upload/r2");
  mock.module("../src/lib/upload/r2", () => ({
    ...r2,
    isR2StorageConfigured: () => r2Configured,
    getR2StorageConfig: () => ({
      bucketName: "bucket",
      client: Object.assign(
        new S3Client({
          region: "auto",
          endpoint: "https://account.r2.cloudflarestorage.com",
          credentials: { accessKeyId: "id", secretAccessKey: "secret" },
        }),
        {
          send: async (command: {
            input: { Key?: string; Prefix?: string };
          }) => {
            const { Key = "", Prefix = "" } = command.input;
            if (command instanceof ListObjectsV2Command) {
              return {
                Contents: [...r2Objects]
                  .filter(([key]) => key.startsWith(Prefix))
                  .map(([key, object]) => ({
                    Key: key,
                    LastModified: object.modified,
                  })),
              };
            }
            if (command instanceof GetObjectCommand) {
              r2Reads.push({ ...command.input });
              const body = r2Objects.get(Key)?.body ?? new Uint8Array();
              return {
                Body: {
                  transformToWebStream: () => new Blob([body.slice()]).stream(),
                },
              };
            }
            r2Objects.delete(Key);
            return {};
          },
        }
      ),
    }),
    deleteR2Keys: async (keys: string[]) => {
      for (const key of keys) {
        r2Objects.delete(key);
      }
      return keys.length;
    },
  }));
  let role = "owner";
  mock.module("../src/lib/auth/organization", () => ({
    assertAuthenticated: async () => ({
      session: {},
      user: { id: "user-a" },
    }),
    assertOrganizationAccess: async () => ({
      organizationId: "org-a",
      membership: { role },
      user: { id: "user-a" },
    }),
  }));
  const subscription = await import("../src/lib/billing/subscription");
  mock.module("../src/lib/billing/subscription", () => ({
    ...subscription,
    assertGeoEntitlement: async () => undefined,
  }));

  const workflows = await import("../src/lib/workflows/start");
  const startedRuns: string[] = [];
  const startedGenerations: (number | undefined)[] = [];
  const deleteRuns: string[] = [];
  mock.module("../src/lib/workflows/start", () => ({
    ...workflows,
    startAnalyticsImportRun: async ({
      importId,
      generation,
    }: {
      importId: string;
      generation?: number;
    }) => {
      startedRuns.push(importId);
      startedGenerations.push(generation);
      return { runId: "run-test" };
    },
    startAnalyticsImportDeleteRun: async ({
      importId,
    }: {
      importId: string;
    }) => {
      deleteRuns.push(importId);
      return { runId: "run-delete" };
    },
  }));
  const runStates = new Map<string, string>();
  const wokenRuns: string[] = [];
  const cancelledRuns: string[] = [];
  mock.module("../src/lib/analytics-imports/runs", () => ({
    readImportRunState: async (runId: string) =>
      runStates.get(runId) ?? "missing",
    wakeImportRun: async (runId: string) => {
      wokenRuns.push(runId);
    },
    cancelImportRun: async (runId: string) => {
      cancelledRuns.push(runId);
    },
  }));

  const imports = await import("../src/lib/analytics-imports/imports");
  const runner = await import("../src/lib/analytics-imports/runner");
  const queue = await import("../src/lib/analytics-imports/queue");
  const { recoverAnalyticsImports } =
    await import("../src/lib/analytics-imports/recovery");
  const storage = await import("../src/lib/analytics-imports/storage");
  const { analyticsImportsRouter } =
    await import("../src/lib/orpc/routers/analytics-imports");
  const { geoRouter } = await import("../src/lib/orpc/routers/geo");
  const { createORPCContext } = await import("../src/lib/orpc/context");
  const {
    ANALYTICS_IMPORT_BUDGET_WAIT,
    ANALYTICS_IMPORT_LOST_ERROR,
    ANALYTICS_IMPORT_LOST_UPLOAD_ERROR,
    ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS,
    ANALYTICS_IMPORT_QUEUE_POLL_SECONDS,
  } = await import("../src/constants/analytics-imports");

  const fixtures = fileURLToPath(
    new URL(
      "../../../packages/geo-core/tests/fixtures/plausible-export",
      import.meta.url
    )
  );
  const fixtureFiles = Object.fromEntries(
    readdirSync(fixtures).map((name) => [
      name,
      new Uint8Array(readFileSync(join(fixtures, name))),
    ])
  );
  const zip = zipSync(fixtureFiles);

  const context = () => createORPCContext({ headers: new Headers() });
  const loadImport = (importId: string) =>
    db.query.analyticsImports.findFirst({
      where: eq(analyticsImports.id, importId),
    });
  const uploadKey = (name: string) => `analytics-imports/org-a/${name}.zip`;
  const sendCsv = async (input: {
    uploadKey?: string;
    file?: File;
    previewOnly?: boolean;
    host?: string;
  }) =>
    call(
      analyticsImportsRouter.csv,
      {
        organizationId: "org-a",
        projectId: "project-a",
        host: "example.com",
        previewOnly: true,
        ...input,
      },
      { context: await context() }
    );

  const createImport = (
    input: Partial<Parameters<typeof imports.createAnalyticsImport>[0]> = {}
  ) =>
    imports.createAnalyticsImport({
      organizationId: "org-a",
      projectId: "project-a",
      userId: "user-a",
      provider: "plausible_csv",
      connectionId: null,
      sourceRef: "plausible-export",
      sourceLabel: input.host ?? "example.com",
      host: "example.com",
      requestedStart: "2026-08-01",
      requestedEnd: "2026-09-30",
      earliestDay: "2026-08-01",
      ...input,
    });
  const createCsvImport = (
    host = "example.com",
    options: { sourceRef?: string; overlap?: "skip" | "add" } = {}
  ) => createImport({ host, ...options });
  const saveConnection = (provider: "plausible" | "vercel") =>
    imports.saveConnection({
      organizationId: "org-a",
      userId: "user-a",
      label: provider,
      credentials:
        provider === "plausible"
          ? { provider, apiKey: "plausible-test-key-123" }
          : { provider, token: "vercel-test-token-1" },
    });
  const createVercelImport = (
    connectionId: string,
    name: string,
    input: Partial<Parameters<typeof imports.createAnalyticsImport>[0]> = {}
  ) =>
    createImport({
      provider: "vercel",
      connectionId,
      sourceRef: `prj_${name}`,
      sourceLabel: name,
      host: `${name}.example`,
      requestedStart: "2026-09-01",
      requestedEnd: null,
      earliestDay: "2026-09-01",
      ...input,
    });

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
      websiteUrl: "https://example.com",
    });
    await db.insert(projects).values({
      id: "project-a",
      organizationId: "org-a",
      name: "Main",
      brandSettingsId: "brand-a",
    });
  });
  afterAll(() => sandbox.postgres.close());
  beforeEach(async () => {
    await db.delete(analyticsImports);
    webRows.length = 0;
    purges.length = 0;
    purgeFailures = 0;
    bumps.length = 0;
    nativeFirstDay = "1970-01-01";
    fetchMock.mockReset();
    r2Configured = false;
    r2Objects.clear();
    r2Reads.length = 0;
    role = "owner";
    startedRuns.length = 0;
    deleteRuns.length = 0;
    runStates.clear();
    wokenRuns.length = 0;
    cancelledRuns.length = 0;
    startedGenerations.length = 0;
  });

  describe("access", () => {
    /** Every procedure that changes imports, keyed for the denial lists. */
    async function procedures() {
      const connection = await saveConnection("plausible");
      const row = await createCsvImport();
      const options = { context: await context() };
      const org = { organizationId: "org-a" };
      const source = {
        ...org,
        connectionId: connection.id,
        projectId: "project-a",
        provider: "plausible" as const,
        sourceRef: "example.com",
        sourceLabel: "example.com",
        host: "example.com",
      };
      const calls = {
        connect: () =>
          call(
            analyticsImportsRouter.connect,
            { ...org, provider: "plausible", secret: "plausible-test-key-456" },
            options
          ),
        sources: () =>
          call(
            analyticsImportsRouter.sources,
            { ...org, connectionId: connection.id },
            options
          ),
        preview: () => call(analyticsImportsRouter.preview, source, options),
        create: () => call(analyticsImportsRouter.create, source, options),
        uploadTarget: () =>
          call(
            analyticsImportsRouter.uploadTarget,
            { ...org, fileSize: 1024 },
            options
          ),
        csv: () =>
          call(
            analyticsImportsRouter.csv,
            {
              ...org,
              projectId: "project-a",
              host: "example.com",
              uploadKey: uploadKey("x"),
              previewOnly: true,
            },
            options
          ),
        rotate: () =>
          call(
            geoRouter.webKeyRotate,
            { ...org, projectId: "project-a" },
            options
          ),
        list: () =>
          call(
            analyticsImportsRouter.list,
            { ...org, projectId: "project-a" },
            options
          ),
        delete: () =>
          call(
            analyticsImportsRouter.delete,
            { ...org, importId: row.id },
            options
          ),
        disconnect: () =>
          call(
            analyticsImportsRouter.disconnect,
            { ...org, connectionId: connection.id, deleteImports: true },
            options
          ),
      };
      return { connection, row, calls };
    }
    const expectDenied = async (
      calls: Record<string, () => Promise<unknown>>,
      names: string[],
      denial: Record<string, string>
    ) => {
      for (const name of names) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one denial at a time
        await expect(calls[name]?.()).rejects.toMatchObject(denial);
      }
    };

    test("members cannot connect, disconnect, delete imports or rotate the public key", async () => {
      role = "member";
      const { connection, row, calls } = await procedures();
      await expectDenied(calls, ["connect", "disconnect", "delete", "rotate"], {
        code: "FORBIDDEN",
      });
      expect(
        await imports.findConnection("org-a", connection.id)
      ).not.toBeNull();
      expect((await loadImport(row.id))?.status).toBe("pending");
      expect((await calls.list()).canManage).toBe(false);
    });
  });

  describe("Plausible CSV import", () => {
    test("imports every row before the first native day once, in contiguous chunks, and reveals the import", async () => {
      nativeFirstDay = "2026-09-30";
      const row = await createCsvImport();
      expect(row).toMatchObject({
        status: "pending",
        cutoffDay: "2026-09-30",
        effectiveStartDay: "2026-08-01",
        effectiveEndDay: "2026-09-29",
        kind: "web",
      });
      await runner.runAnalyticsImportInline(row.id, zip);
      const saved = await loadImport(row.id);
      expect(saved).toMatchObject({
        status: "completed",
        pageviewsImported: 304 + 325 + 233 + 2681,
      });
      expect(saved?.chunksTotal).toBeGreaterThan(1);
      expect(saved?.chunksDone).toBe(saved?.chunksTotal);
      const chunks = await db.query.analyticsImportChunks.findMany({
        where: eq(analyticsImportChunks.importId, row.id),
      });
      expect(chunks.reduce((sum, chunk) => sum + chunk.pageviews, 0)).toBe(
        304 + 325 + 233 + 2681
      );
      const ordered = chunks.toSorted((a, b) =>
        a.chunkStart.localeCompare(b.chunkStart)
      );
      expect(ordered.at(0)?.chunkStart).toBe("2026-08-01");
      expect(ordered.at(-1)?.chunkEnd).toBe("2026-09-29");
      for (const [index, chunk] of ordered.slice(1).entries()) {
        const previous = new Date(`${ordered[index]?.chunkEnd}T00:00:00Z`);
        previous.setUTCDate(previous.getUTCDate() + 1);
        expect(chunk.chunkStart).toBe(previous.toISOString().slice(0, 10));
      }
      expect(webRows.every((item) => String(item.day) < "2026-09-30")).toBe(
        true
      );
      expect(webRows.some((item) => item.day === "2026-09-29")).toBe(true);
      expect(new Set(webRows.map((item) => item.import_id))).toEqual(
        new Set([row.id])
      );
      expect(bumps).toEqual(["org-a"]);
    });

    test("another import of the host, its www alias or a subdomain skips days already covered", async () => {
      const first = await createCsvImport();
      await runner.runAnalyticsImportInline(first.id, zip);
      for (const host of [
        "example.com",
        "www.example.com",
        "docs.example.com",
      ]) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- one host at a time
        await expect(createCsvImport(host)).rejects.toBeInstanceOf(
          imports.AnalyticsImportInputError
        );
      }
      const plan = (host: string, sourceRef = "plausible-export") =>
        imports.planImportRange({
          organizationId: "org-a",
          projectId: "project-a",
          provider: "plausible_csv",
          sourceRef,
          host,
          requestedStart: "2026-01-01",
          requestedEnd: "2026-09-30",
          earliestDay: "2026-01-01",
        });
      expect(await plan("example.com")).toMatchObject({
        range: { start: "2026-01-01", end: "2026-07-31" },
        clipped: true,
      });
      // The same export never imports its days twice, under any domain.
      expect(await plan("notexample.com")).toMatchObject({
        range: { start: "2026-01-01", end: "2026-07-31" },
        alreadyImported: true,
      });
      expect((await plan("notexample.com", "other-export")).range).toEqual({
        start: "2026-01-01",
        end: "2026-09-30",
      });
    });

    test("deleting hides the import and purges its Tinybird rows", async () => {
      const row = await createCsvImport();
      await runner.runAnalyticsImportInline(row.id, zip);
      expect(await imports.markImportDeleting("org-b", row.id)).toBeNull();
      expect((await imports.markImportDeleting("org-a", row.id))?.status).toBe(
        "deleting"
      );
      await runner.deleteAnalyticsImportData(row.id);
      expect(purges).toEqual([{ organizationId: "org-a", importId: row.id }]);
      expect(await imports.listAnalyticsImports("org-a", "project-a")).toEqual(
        []
      );
    });

    test("a broken export fails the import and removes partial rows", async () => {
      const row = await createCsvImport();
      await runner.runAnalyticsImportInline(row.id, new Uint8Array([1, 2, 3]));
      const saved = await loadImport(row.id);
      expect(saved?.status).toBe("failed");
      expect(saved?.lastError).toBe(
        "This ZIP has no files from Plausible's CSV export"
      );
      expect(purges).toEqual([{ organizationId: "org-a", importId: row.id }]);
    });

    test("a failed cleanup leaves the import active so a retry removes its rows", async () => {
      const row = await createCsvImport();
      purgeFailures = 1;
      await expect(
        runner.failAnalyticsImport(row.id, "bad export")
      ).rejects.toThrow("Tinybird delete failed");
      expect((await loadImport(row.id))?.status).toBe("pending");
      await runner.failAnalyticsImport(row.id, "bad export");
      expect(await loadImport(row.id)).toMatchObject({
        status: "failed",
        lastError: "bad export",
      });
      expect(purges).toEqual([{ organizationId: "org-a", importId: row.id }]);
    });
  });

  describe("uploaded exports", () => {
    test("with object storage configured, an inline upload is refused unread", async () => {
      r2Configured = true;
      await expect(
        sendCsv({
          file: new File([zip], "export.zip", { type: "application/zip" }),
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Upload the export to storage first",
      });
    });

    test("an export that fails its check is deleted; a retried start of a good one returns the same import", async () => {
      r2Configured = true;
      const now = new Date();
      r2Objects.set(uploadKey("broken"), {
        body: new Uint8Array([1, 2, 3]),
        modified: now,
      });
      r2Objects.set(uploadKey("good"), { body: zip, modified: now });
      await expect(
        sendCsv({ uploadKey: uploadKey("broken") })
      ).rejects.toThrow();
      expect(r2Objects.has(uploadKey("broken"))).toBe(false);

      const start = () =>
        sendCsv({ uploadKey: uploadKey("good"), previewOnly: false });
      const first = await start();
      expect((await start()).import?.id).toBe(first.import?.id);
      expect(r2Objects.has(uploadKey("good"))).toBe(true);
    });

    test("each upload is encrypted with its own key, which the PUT and every read must send", async () => {
      r2Configured = true;
      const target = async () =>
        (
          await call(
            analyticsImportsRouter.uploadTarget,
            { organizationId: "org-a", fileSize: zip.length },
            { context: await context() }
          )
        ).target;
      const first = await target();
      const second = await target();
      if (first.mode !== "storage" || second.mode !== "storage") {
        throw new Error("expected storage uploads");
      }
      expect(first.key).toMatch(/^analytics-imports\/org-a\/[\w-]+\.zip$/);
      const sseKey = "x-amz-server-side-encryption-customer-key";
      expect(first.headers).toMatchObject({
        "x-amz-server-side-encryption-customer-algorithm": "AES256",
      });
      expect(first.headers[sseKey]).not.toBe(second.headers[sseKey]);
      const signed = new URL(first.url).searchParams.get("X-Amz-SignedHeaders");
      expect(signed?.split(";")).toEqual(
        expect.arrayContaining([
          "content-length",
          "x-amz-server-side-encryption-customer-algorithm",
          sseKey,
          `${sseKey}-md5`,
        ])
      );
      expect(first.url).not.toContain(
        encodeURIComponent(String(first.headers[sseKey]))
      );

      r2Objects.set(first.key, { body: zip, modified: new Date() });
      await sendCsv({ uploadKey: first.key });
      expect(r2Reads).toEqual([
        expect.objectContaining({
          Key: first.key,
          SSECustomerAlgorithm: "AES256",
          SSECustomerKey: first.headers[sseKey],
          SSECustomerKeyMD5: first.headers[`${sseKey}-md5`],
        }),
      ]);
      await expect(
        sendCsv({ uploadKey: "organization/org-a/analytics-imports/old.zip" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    test("the daily sweep removes old exports no running import reads", async () => {
      r2Configured = true;
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      r2Objects.set(uploadKey("abandoned"), { body: zip, modified: old });
      r2Objects.set(uploadKey("importing"), { body: zip, modified: old });
      r2Objects.set(uploadKey("fresh"), { body: zip, modified: new Date() });
      await createImport({ uploadKey: uploadKey("importing") });
      expect(await storage.sweepImportUploads()).toBe(1);
      expect([...r2Objects.keys()].toSorted()).toEqual([
        uploadKey("fresh"),
        uploadKey("importing"),
      ]);
    });
  });

  test("the chart hand-over marker follows the latest import that can write the hosts being read", async () => {
    nativeFirstDay = "2026-09-15";
    const docs = await createCsvImport("example.com");
    await runner.runAnalyticsImportInline(docs.id, zip);
    nativeFirstDay = "2026-11-01";
    const other = await createCsvImport("other.example", {
      sourceRef: "export-other",
    });
    await runner.runAnalyticsImportInline(other.id, zip);
    const { forgetCompletedImportIds, loadCompletedImports } =
      await import("@notra/geo-core/geo/analytics-imports");
    forgetCompletedImportIds("org-a");
    const coverage = async (hosts: string[]) =>
      (
        await Effect.runPromise(
          loadCompletedImports("org-a", "project-a", "web", hosts)
        )
      ).coverage;
    expect(await coverage(["www.example.com"])).toEqual({
      provider: "plausible_csv",
      until: "2026-09-14",
      nativeStart: "2026-09-15",
    });
    expect((await coverage([]))?.nativeStart).toBe("2026-11-01");
    expect(await coverage(["unrelated.example"])).toBeNull();

    nativeFirstDay = "1970-01-01";
    const beforeTracking = await createCsvImport("new.example", {
      sourceRef: "export-new",
    });
    await runner.runAnalyticsImportInline(beforeTracking.id, zip);
    forgetCompletedImportIds("org-a");
    expect((await coverage(["new.example"]))?.nativeStart).toBeNull();
  });

  describe("Plausible API import", () => {
    async function apiImport() {
      const connection = await saveConnection("plausible");
      expect(connection.encryptedCredentials).not.toContain(
        "plausible-test-key-123"
      );
      return await createImport({
        provider: "plausible",
        connectionId: connection.id,
        sourceRef: "example.com",
        requestedStart: null,
        requestedEnd: null,
        earliestDay: "2026-08-15",
      });
    }
    const dailyResults =
      (...days: [string, number[]][]) =>
      async (_url: unknown, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        return Response.json({
          results:
            body.dimensions.length === 1
              ? days.map(([day, metrics]) => ({ dimensions: [day], metrics }))
              : [],
          meta: { total_rows: days.length },
        });
      };

    test("plans month chunks newest first and resumes after a rate limit", async () => {
      nativeFirstDay = "2026-10-03";
      const row = await apiImport();
      const plan = await runner.planAnalyticsImport(row.id);
      expect(plan?.chunks).toEqual(["2026-10-01", "2026-09-01", "2026-08-15"]);

      fetchMock.mockResolvedValueOnce(
        new Response("slow", { status: 429, headers: { "Retry-After": "90" } })
      );
      expect(
        await runner.runAnalyticsImportChunk(row.id, "2026-10-01")
      ).toEqual({ status: "rate_limited", retryAfterSeconds: 90 });
      expect((await loadImport(row.id))?.status).toBe("waiting_rate_limit");

      fetchMock.mockImplementation(
        dailyResults(
          ["2026-10-01", [5, 6, 9, 50, 10]],
          ["2026-10-02", [7, 8, 11, 25, 20]]
        )
      );
      expect(
        await runner.runAnalyticsImportChunk(row.id, "2026-10-01")
      ).toEqual({ status: "done" });
      expect(
        new Headers(fetchMock.mock.calls.at(-1)?.[1]?.headers).get(
          "authorization"
        )
      ).toBe("Bearer plausible-test-key-123");
      // A rate-limited attempt wrote nothing, so the retry deletes nothing.
      expect(purges).toEqual([]);
      expect(
        webRows.map((item) => [item.day, item.pageviews, item.bounces])
      ).toEqual([
        ["2026-10-01", 9, 3],
        ["2026-10-02", 11, 2],
      ]);
      // A resumed run only gets the chunks that are not done yet.
      expect((await runner.planAnalyticsImport(row.id))?.chunks).toEqual([
        "2026-09-01",
        "2026-08-15",
      ]);
    });

    const forbidden = async () => new Response("no", { status: 403 });
    const connectionStatus = async (importId: string) =>
      (
        await imports.findConnection(
          "org-a",
          (await loadImport(importId))?.connectionId ?? ""
        )
      )?.status;

    test("a 403 on the first chunk fails the chunk and asks for reauth", async () => {
      nativeFirstDay = "2026-10-03";
      const row = await apiImport();
      await runner.planAnalyticsImport(row.id);
      fetchMock.mockImplementation(forbidden);
      expect(
        await runner.runAnalyticsImportChunk(row.id, "2026-10-01")
      ).toMatchObject({ status: "failed" });
      expect(await connectionStatus(row.id)).toBe("reauth_required");
    });

    test("a 403 after earlier chunks waits and retries before asking for reauth", async () => {
      nativeFirstDay = "2026-10-03";
      const row = await apiImport();
      await runner.planAnalyticsImport(row.id);
      fetchMock.mockImplementation(
        dailyResults(["2026-10-01", [5, 6, 9, 50, 10]])
      );
      expect(
        await runner.runAnalyticsImportChunk(row.id, "2026-10-01")
      ).toEqual({ status: "done" });
      fetchMock.mockImplementation(forbidden);
      for (let attempt = 1; attempt < 3; attempt++) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop -- attempts run one after another
        expect(
          await runner.runAnalyticsImportChunk(row.id, "2026-09-01")
        ).toEqual({ status: "rate_limited", retryAfterSeconds: 300 });
      }
      expect((await loadImport(row.id))?.status).toBe("waiting_rate_limit");
      expect(await connectionStatus(row.id)).toBe("active");
      expect(
        await runner.runAnalyticsImportChunk(row.id, "2026-09-01")
      ).toMatchObject({ status: "failed" });
      expect(await connectionStatus(row.id)).toBe("reauth_required");
    });

    test.each([
      [
        "a rate-limited",
        async () =>
          new Response("slow", {
            status: 429,
            headers: { "Retry-After": "90" },
          }),
      ],
      ["a successful", dailyResults(["2026-08-20", [5, 6, 9, 50, 10]])],
    ])(
      "a delete during %s request is never undone and its rows are purged",
      async (_name, respond) => {
        nativeFirstDay = "2026-09-01";
        const row = await apiImport();
        await runner.planAnalyticsImport(row.id);
        let deleted = false;
        fetchMock.mockImplementation(async (url, init) => {
          if (!deleted) {
            deleted = true;
            await imports.markImportDeleting("org-a", row.id);
            await runner.deleteAnalyticsImportData(row.id);
          }
          return await respond(url, init);
        });
        expect(
          await runner.runAnalyticsImportChunk(row.id, "2026-08-15")
        ).toEqual({ status: "cancelled" });
        expect(purges).toEqual([
          { organizationId: "org-a", importId: row.id },
          {
            organizationId: "org-a",
            importId: row.id,
            fromDay: "2026-08-15",
            toDay: "2026-08-31",
          },
        ]);
        expect(await loadImport(row.id)).toMatchObject({
          status: "deleted",
          chunksDone: 0,
        });
        expect(await runner.planAnalyticsImport(row.id)).toBeNull();
      }
    );
  });

  describe("several sources for one domain", () => {
    const pageviewsOf = (importId: string) =>
      webRows
        .filter((row) => row.import_id === importId && row.grain === "total")
        .reduce((sum, row) => sum + Number(row.pageviews), 0);

    test("another source's days are reported; skip leaves them out, add keeps them", async () => {
      const plan = (sourceRef: string, overlap?: "skip" | "add") =>
        imports.planImportRange({
          organizationId: "org-a",
          projectId: "project-a",
          provider: "plausible_csv",
          sourceRef,
          host: "www.example.com",
          requestedStart: "2026-07-01",
          requestedEnd: "2026-09-30",
          earliestDay: "2026-07-01",
          overlap,
        });
      const first = await createCsvImport("example.com", {
        sourceRef: "plausible-export:aaa",
      });
      await runner.runAnalyticsImportInline(first.id, zip);

      const skipped = await plan("plausible-export:bbb");
      expect(skipped.range).toEqual({ start: "2026-07-01", end: "2026-07-31" });
      expect(skipped.alreadyImported).toBe(false);
      expect(skipped.overlaps).toEqual([
        {
          importId: first.id,
          provider: "plausible_csv",
          sourceLabel: "example.com",
          host: "example.com",
          startDay: "2026-08-01",
          endDay: "2026-09-30",
        },
      ]);
      const counts = {
        "2026-07-01": 10,
        "2026-07-31": 5,
        "2026-08-15": 100,
        "2026-09-30": 1000,
      };
      expect(
        imports.toPreview("plausible_csv", skipped, { total: 1115, counts })
      ).toMatchObject({
        startDay: "2026-07-01",
        endDay: "2026-07-31",
        pageviews: 15,
        added: {
          startDay: "2026-07-01",
          endDay: "2026-09-30",
          months: 3,
          pageviews: 1115,
        },
      });
      expect((await plan("plausible-export:bbb", "add")).range).toEqual({
        start: "2026-07-01",
        end: "2026-09-30",
      });
      // A source never imports its own days twice, whatever the choice.
      const own = await plan("plausible-export:aaa", "add");
      expect(own.range).toEqual({ start: "2026-07-01", end: "2026-07-31" });
      expect(own.overlaps).toEqual([]);
      expect(own.alreadyImported).toBe(true);

      const merged = await createCsvImport("example.com", {
        sourceRef: "plausible-export:bbb",
        overlap: "add",
      });
      expect(merged).toMatchObject({
        effectiveStartDay: "2026-08-01",
        effectiveEndDay: "2026-09-30",
      });
      await runner.runAnalyticsImportInline(merged.id, zip);
      expect(pageviewsOf(merged.id)).toBe(pageviewsOf(first.id));
      expect(pageviewsOf(merged.id)).toBeGreaterThan(0);
      await expect(
        createCsvImport("example.com", { sourceRef: "plausible-export:ccc" })
      ).rejects.toThrow("Nothing to import");
    });

    test("an export is identified by its content: the same ZIP twice is one source", async () => {
      r2Configured = true;
      const otherZip = zipSync({
        ...fixtureFiles,
        ".exported-by-someone-else": new Uint8Array([1]),
      });
      r2Objects.set(uploadKey("first"), { body: zip, modified: new Date() });
      r2Objects.set(uploadKey("again"), { body: zip, modified: new Date() });
      r2Objects.set(uploadKey("other"), {
        body: otherZip,
        modified: new Date(),
      });

      const first = await sendCsv({
        uploadKey: uploadKey("first"),
        previewOnly: false,
      });
      expect(
        (await sendCsv({ uploadKey: uploadKey("again") })).preview
      ).toMatchObject({ startDay: null, overlaps: [] });
      await expect(
        sendCsv({ uploadKey: uploadKey("again"), previewOnly: false })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const other = await sendCsv({ uploadKey: uploadKey("other") });
      expect(other.preview?.overlaps.map((item) => item.importId)).toEqual([
        first.import?.id ?? "",
      ]);
    });

    test("a source can't run twice at once, even for other days", async () => {
      nativeFirstDay = "2026-10-01";
      const connection = await saveConnection("vercel");
      const create = (start: string, end: string) =>
        createVercelImport(connection.id, "marketing", {
          host: "example.com",
          requestedStart: start,
          requestedEnd: end,
          earliestDay: "2026-01-01",
        });
      await create("2026-09-01", "2026-09-10");
      await expect(create("2026-09-20", "2026-09-30")).rejects.toThrow(
        "This site is already being imported"
      );
    });

    test("two imports started at once can't both claim the same days", async () => {
      const results = await Promise.allSettled([
        createCsvImport("example.com", { sourceRef: "plausible-export:aaa" }),
        createCsvImport("www.example.com", {
          sourceRef: "plausible-export:bbb",
        }),
      ]);
      expect(
        results.filter((item) => item.status === "fulfilled")
      ).toHaveLength(1);
      const rejected = results.find((item) => item.status === "rejected");
      expect(
        rejected?.status === "rejected" ? rejected.reason : null
      ).toBeInstanceOf(imports.AnalyticsImportInputError);
    });
  });

  test.each([
    ["finishes", (id: string) => runner.finalizeAnalyticsImport(id)],
    ["fails", (id: string) => runner.failAnalyticsImport(id, "bad token")],
    [
      "is deleted",
      async (id: string) => {
        await imports.markImportDeleting("org-a", id);
        await runner.deleteAnalyticsImportData(id);
      },
    ],
  ])(
    "imports from one account queue; the next runs once the first %s",
    async (_name, release) => {
      nativeFirstDay = "2026-10-01";
      const connection = await saveConnection("vercel");
      const marketing = await createVercelImport(connection.id, "marketing");
      // The queue runs in creation order; keep the two creation times apart.
      await new Promise((resolve) => setTimeout(resolve, 5));
      const docs = await createVercelImport(connection.id, "docs");
      await imports.setImportWorkflowRun(docs.id, "run-docs");
      const waitingFor = async () =>
        (await imports.listAnalyticsImports("org-a", "project-a")).find(
          (item) => item.id === docs.id
        )?.waitingFor;

      expect(await queue.importQueueTurn(marketing.id)).toEqual({
        status: "ready",
      });
      await runner.planAnalyticsImport(marketing.id);
      expect(await queue.importQueueTurn(docs.id)).toEqual({
        status: "waiting",
        retryAfterSeconds: ANALYTICS_IMPORT_QUEUE_POLL_SECONDS,
      });
      expect(await waitingFor()).toBe("marketing");

      await release(marketing.id);
      expect(wokenRuns).toEqual(["run-docs"]);
      expect(await queue.importQueueTurn(docs.id)).toEqual({ status: "ready" });
      expect(await waitingFor()).toBeNull();
    }
  );

  test("recovery restarts lost runs, leaves live ones alone and fails what can't resume", async () => {
    nativeFirstDay = "2026-10-01";
    const connection = await saveConnection("vercel");
    const create = async (name: string, runState: string | null) => {
      const row = await createVercelImport(connection.id, name);
      await imports.setImportWorkflowRun(row.id, `run-${name}`);
      if (runState) {
        runStates.set(`run-${name}`, runState);
      }
      return row;
    };
    const alive = await create("alive", "running");
    const lost = await create("lost", "failed");
    const tired = await create("tired", null);
    await db
      .update(analyticsImports)
      .set({ recoveryAttempts: ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS })
      .where(eq(analyticsImports.id, tired.id));
    const inline = await createCsvImport("inline.example");

    // Nothing is stale yet.
    expect(await recoverAnalyticsImports()).toEqual({
      checked: 0,
      restarted: 0,
      failed: 0,
    });
    expect(await recoverAnalyticsImports(Date.now() + 60 * 60 * 1000)).toEqual({
      checked: 4,
      restarted: 1,
      failed: 2,
    });
    expect(await loadImport(alive.id)).toMatchObject({
      status: "pending",
      workflowRunId: "run-alive",
      recoveryAttempts: 0,
    });
    expect(startedRuns).toEqual([lost.id]);
    expect(await loadImport(lost.id)).toMatchObject({
      status: "pending",
      workflowRunId: "run-test",
      recoveryAttempts: 1,
    });
    expect(await loadImport(tired.id)).toMatchObject({
      status: "failed",
      lastError: ANALYTICS_IMPORT_LOST_ERROR,
    });
    expect(await loadImport(inline.id)).toMatchObject({
      status: "failed",
      lastError: ANALYTICS_IMPORT_LOST_UPLOAD_ERROR,
    });
  });

  test("recovery restarts a rate-limit wait that never woke, and the old run never imports again", async () => {
    nativeFirstDay = "2026-10-01";
    const connection = await saveConnection("vercel");
    const sleepy = await createVercelImport(connection.id, "sleepy");
    const [chunk = ""] =
      (await runner.planAnalyticsImport(sleepy.id))?.chunks ?? [];
    await imports.setImportWorkflowRun(sleepy.id, "run-sleepy");
    runStates.set("run-sleepy", "running");
    fetchMock.mockResolvedValueOnce(
      new Response("slow", { status: 429, headers: { "Retry-After": "60" } })
    );
    expect(
      await runner.runAnalyticsImportChunk(sleepy.id, chunk, { generation: 0 })
    ).toEqual({ status: "rate_limited", retryAfterSeconds: 60 });
    // Vercel's hourly window: a long wait that is still due is left alone.
    const patient = await createVercelImport(connection.id, "patient");
    await imports.setImportWorkflowRun(patient.id, "run-patient");
    runStates.set("run-patient", "running");
    await db
      .update(analyticsImports)
      .set({
        status: "waiting_rate_limit",
        retryAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .where(eq(analyticsImports.id, patient.id));

    const later = Date.now() + 20 * 60 * 1000;
    expect(await recoverAnalyticsImports(later)).toEqual({
      checked: 2,
      restarted: 1,
      failed: 0,
    });
    expect(startedRuns).toEqual([sleepy.id]);
    expect(startedGenerations).toEqual([1]);
    expect(cancelledRuns).toEqual(["run-sleepy"]);
    expect(await loadImport(sleepy.id)).toMatchObject({
      status: "pending",
      retryAt: null,
      workflowRunId: "run-test",
      recoveryAttempts: 1,
    });
    expect(await loadImport(patient.id)).toMatchObject({
      status: "waiting_rate_limit",
      workflowRunId: "run-patient",
      recoveryAttempts: 0,
    });

    // If the old run wakes after all, it stops before claiming the chunk.
    fetchMock.mockImplementation(async () => Response.json({ data: [] }));
    const requests = fetchMock.mock.calls.length;
    expect(
      await runner.runAnalyticsImportChunk(sleepy.id, chunk, { generation: 0 })
    ).toEqual({ status: "cancelled" });
    expect(fetchMock.mock.calls.length).toBe(requests);
    // A run started before generations existed is fenced by its run id.
    expect(
      await runner.runAnalyticsImportChunk(sleepy.id, chunk, {
        runId: "run-sleepy",
      })
    ).toEqual({ status: "cancelled" });
    expect(fetchMock.mock.calls.length).toBe(requests);
    expect(
      await runner.runAnalyticsImportChunk(sleepy.id, chunk, { generation: 1 })
    ).toEqual({ status: "done" });
  });

  test("a run without a generation goes on while it is still the import's current run", async () => {
    nativeFirstDay = "2026-10-01";
    const connection = await saveConnection("vercel");
    // Recovery before generations restarted it without passing one.
    const older = await createVercelImport(connection.id, "older");
    const [chunk = ""] =
      (await runner.planAnalyticsImport(older.id))?.chunks ?? [];
    await imports.setImportWorkflowRun(older.id, "run-older");
    await db
      .update(analyticsImports)
      .set({ recoveryAttempts: 2 })
      .where(eq(analyticsImports.id, older.id));
    fetchMock.mockImplementation(async () => Response.json({ data: [] }));

    expect(
      await runner.runAnalyticsImportChunk(older.id, chunk, {
        runId: "run-older",
      })
    ).toEqual({ status: "done" });
  });

  test("at the last attempt an overdue wait is claimed before it fails; a resumed import is kept", async () => {
    nativeFirstDay = "2026-10-01";
    const connection = await saveConnection("vercel");
    const overdue = await createVercelImport(connection.id, "overdue");
    const resumed = await createVercelImport(connection.id, "resumed");
    const [chunk = ""] =
      (await runner.planAnalyticsImport(overdue.id))?.chunks ?? [];
    for (const [row, runId, status] of [
      [overdue, "run-overdue", "waiting_rate_limit"],
      [resumed, "run-resumed", "running"],
    ] as const) {
      await imports.setImportWorkflowRun(row.id, runId);
      runStates.set(runId, "running");
      await db
        .update(analyticsImports)
        .set({
          status,
          retryAt: new Date(Date.now() - 60 * 60 * 1000),
          recoveryAttempts: ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS,
        })
        .where(eq(analyticsImports.id, row.id));
    }

    // Recovery only looks at imports left untouched for a while.
    const result = await recoverAnalyticsImports(Date.now() + 20 * 60 * 1000);
    expect(result.failed).toBe(1);
    expect(await loadImport(overdue.id)).toMatchObject({
      status: "failed",
      lastError: ANALYTICS_IMPORT_LOST_ERROR,
      recoveryAttempts: ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS + 1,
    });
    expect(cancelledRuns).toEqual(["run-overdue"]);
    // The old run is fenced by the claim and imports nothing if it wakes,
    // with or without a generation.
    for (const fence of [
      { generation: ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS },
      { runId: "run-overdue" },
    ]) {
      expect(
        await runner.runAnalyticsImportChunk(overdue.id, chunk, fence)
      ).toEqual({ status: "cancelled" });
    }
    // An import whose run picked up again is alive: never failed.
    expect(await loadImport(resumed.id)).toMatchObject({ status: "running" });
  });

  test("a wait on Notra's own request budget is stored apart from a provider's", async () => {
    nativeFirstDay = "2026-10-01";
    const connection = await saveConnection("vercel");
    const row = await createVercelImport(connection.id, "budget");
    const [chunk = ""] =
      (await runner.planAnalyticsImport(row.id))?.chunks ?? [];
    fetchMock.mockRejectedValueOnce(
      new ImportRateLimitedError({
        provider: "vercel",
        retryAfterSeconds: 1800,
        budget: true,
      })
    );
    expect(await runner.runAnalyticsImportChunk(row.id, chunk)).toEqual({
      status: "rate_limited",
      retryAfterSeconds: 1800,
    });
    const listed = async () =>
      (await imports.listAnalyticsImports("org-a", "project-a")).find(
        (item) => item.id === row.id
      );
    expect(await listed()).toMatchObject({
      status: "waiting_rate_limit",
      lastError: ANALYTICS_IMPORT_BUDGET_WAIT,
    });

    fetchMock.mockResolvedValueOnce(
      new Response("slow", { status: 429, headers: { "Retry-After": "60" } })
    );
    await runner.runAnalyticsImportChunk(row.id, chunk);
    expect(await listed()).toMatchObject({
      status: "waiting_rate_limit",
      lastError: null,
    });
  });

  test("recovery starts a lost delete again, once per stale window", async () => {
    const row = await createCsvImport("stuck.example");
    await imports.markImportDeleting("org-a", row.id);
    const later = Date.now() + 60 * 60 * 1000;
    expect(await recoverAnalyticsImports()).toMatchObject({ restarted: 0 });
    // Two sweeps that overlap claim the row once.
    const sweeps = await Promise.all([
      recoverAnalyticsImports(later),
      recoverAnalyticsImports(later),
    ]);
    expect(sweeps.reduce((sum, sweep) => sum + sweep.restarted, 0)).toBe(1);
    expect(deleteRuns).toEqual([row.id]);
    // The retry touched the row, so the next sweep waits again.
    expect(await recoverAnalyticsImports(Date.now())).toMatchObject({
      restarted: 0,
    });
    expect(deleteRuns).toEqual([row.id]);
  });
}
