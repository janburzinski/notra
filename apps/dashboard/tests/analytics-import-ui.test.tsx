import { expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import messages from "../messages/en.json";
import type {
  AnalyticsImportPreview,
  AnalyticsImportSummary,
} from "../src/types/analytics-imports";

if (!process.env.NOTRA_ANALYTICS_IMPORT_UI_TEST_WORKER) {
  test("import history UI renders progress, preview and connect guides", () => {
    const result = spawnSync(
      process.execPath,
      ["test", fileURLToPath(import.meta.url)],
      {
        env: { ...process.env, NOTRA_ANALYTICS_IMPORT_UI_TEST_WORKER: "1" },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
  });
} else {
  const { ImportList } =
    await import("../src/components/analytics-import/import-list");
  const { ImportPreview } =
    await import("../src/components/analytics-import/import-preview");
  const { ImportConnectStep } =
    await import("../src/components/analytics-import/import-connect-step");
  const { ImportProviderPicker } =
    await import("../src/components/analytics-import/import-provider-picker");
  const { ImportZipField } =
    await import("../src/components/analytics-import/import-zip-field");
  const { ImportProgressView } =
    await import("../src/components/analytics-import/import-progress-view");
  const { ImportActivityPill } =
    await import("../src/components/analytics-import/import-activity-pill");
  const { settleFinishedImports } =
    await import("../src/lib/hooks/use-analytics-import-notices");
  const { finishedSinceLastSeen } =
    await import("../src/utils/analytics-import-watch");
  mock.module("../src/lib/hooks/use-geo-active-project", () => ({
    useGeoActiveProject: () => ({
      project: { id: "project" },
      domain: "example.com",
    }),
  }));
  const { ImportHistoryCard } =
    await import("../src/components/analytics-import/import-history-card");
  const { ANALYTICS_IMPORT_LOST_ERROR } =
    await import("../src/constants/analytics-imports");
  const { dashboardOrpc } = await import("../src/lib/orpc/query");
  const lostError = messages.geo.analyticsImport.list.errors.lost.replace(
    "'",
    "&#x27;"
  );

  const render = (node: React.ReactNode, queryClient = new QueryClient()) =>
    renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <IntlProvider locale="en" messages={messages} timeZone="UTC">
          {node}
        </IntlProvider>
      </QueryClientProvider>
    );

  const running: AnalyticsImportSummary = {
    id: "imp_1",
    projectId: "project",
    provider: "plausible",
    kind: "web",
    sourceLabel: "example.com",
    host: "example.com",
    status: "running",
    startDay: "2025-10-01",
    endDay: "2026-09-30",
    cutoffDay: "2026-10-01",
    chunksTotal: 12,
    chunksDone: 3,
    pageviewsImported: 26_270,
    rowsWritten: 1000,
    capabilities: {
      visitors: true,
      visits: true,
      bounces: true,
      utm: true,
      entryPages: true,
      sampled: false,
    },
    lastError: null,
    retryAt: null,
    waitingFor: null,
    createdAt: "2026-11-04T00:00:00.000Z",
    completedAt: null,
  };
  const queued: AnalyticsImportSummary = {
    ...running,
    id: "imp_q",
    status: "pending",
    chunksTotal: 0,
    chunksDone: 0,
    pageviewsImported: 0,
    waitingFor: "marketing",
  };
  const connection = {
    id: "aic_1",
    provider: "cloudflare" as const,
    label: "Cloudflare",
    status: "active" as const,
    lastError: null,
    createdAt: "2026-11-04T00:00:00.000Z",
  };

  test("the progress view names the month it's on, what it brought in and why it stopped", () => {
    const progress = (item: Partial<AnalyticsImportSummary>) =>
      render(<ImportProgressView item={{ ...running, ...item }} />);
    expect(progress({})).toContain("June 2026 · 4 of 12 months");
    expect(
      progress({
        status: "waiting_rate_limit",
        retryAt: new Date(Date.now() + 42_000).toISOString(),
      })
    ).toContain("Plausible asked for a pause. Resumes in");
    const done = progress({ status: "completed", chunksDone: 12 });
    expect(done).toContain("26,270 page views imported");
    expect(done).toContain("Your charts now go back to Oct 1, 2025.");
    const stopped = progress({
      status: "failed",
      lastError: ANALYTICS_IMPORT_LOST_ERROR,
    });
    expect(stopped).toContain("The import stopped");
    expect(stopped).toContain(lostError);
  });

  test("the list shows progress, the queue and translated errors", () => {
    const html = render(
      <ImportList
        canManage={false}
        connections={[]}
        imports={[
          running,
          queued,
          {
            ...running,
            id: "imp_failed",
            status: "failed",
            lastError: ANALYTICS_IMPORT_LOST_ERROR,
          },
        ]}
        onOpen={() => undefined}
        organizationId="org"
      />
    );
    expect(html).toContain("Step 4 of 12");
    expect(html).toContain("26,270 page views");
    expect(html).toContain("Waiting for marketing to finish");
    expect(html).toContain(lostError);
    // Active imports open their progress; a stopped one does not.
    expect(html.match(/Show progress/g)).toHaveLength(2);
  });

  test("members see imports and saved accounts but no actions to change them", () => {
    const list = (canManage: boolean) =>
      render(
        <ImportList
          canManage={canManage}
          connections={[connection]}
          imports={[running]}
          organizationId="org"
        />
      );
    expect(list(false)).toContain("example.com");
    expect(list(false)).not.toContain("Actions for");
    expect(list(true)).toContain("Actions for example.com");
    expect(list(true)).toContain("Actions for Cloudflare");
    const connect = render(
      <ImportConnectStep
        canManage={false}
        connections={[connection]}
        onConnected={() => undefined}
        organizationId="org"
        provider="cloudflare"
      />
    );
    expect(connect).toContain("Only owners and admins can connect");
    expect(connect).not.toContain("Zone → Analytics → Read");
  });

  test("Rybbit and Databuddy are in the source list and ask for read-only keys", () => {
    const picker = render(<ImportProviderPicker onPick={() => undefined} />);
    expect(picker).toContain("Rybbit");
    expect(picker).toContain("Databuddy");
    const connect = (provider: "rybbit" | "databuddy") =>
      render(
        <ImportConnectStep
          canManage
          connections={[]}
          onConnected={() => undefined}
          organizationId="org"
          provider={provider}
        />
      );
    expect(connect("rybbit")).toContain("analytics:read");
    expect(connect("databuddy")).toContain("read:data");
  });

  test("a saved account starts a new import unless it needs a reconnect", () => {
    const list = (status: "active" | "reauth_required") =>
      render(
        <ImportList
          canManage
          connections={[{ ...connection, status }]}
          imports={[]}
          onUse={() => undefined}
          organizationId="org"
        />
      );
    expect(list("active")).toContain("Import with this account");
    expect(list("reauth_required")).not.toContain("Import with this account");
  });

  test("the connect step lists Cloudflare's read permissions and reconnecting hides saved accounts", () => {
    const cloudflare = render(
      <ImportConnectStep
        canManage
        connections={[]}
        onConnected={() => undefined}
        organizationId="org"
        provider="cloudflare"
      />
    );
    expect(cloudflare).toContain("Zone → Analytics → Read");
    expect(cloudflare).toContain("Account → Account Analytics → Read");
    const reconnect = render(
      <ImportConnectStep
        canManage
        connections={[{ ...connection, provider: "vercel", label: "Old team" }]}
        onConnected={() => undefined}
        organizationId="org"
        provider="vercel"
        reconnectId="aic_1"
      />
    );
    expect(reconnect).not.toContain("Old team");
    expect(reconnect).toContain("can&#x27;t be limited to read-only");
  });

  const basePreview: AnalyticsImportPreview = {
    provider: "plausible_csv",
    kind: "web",
    cutoffDay: "2026-09-30",
    nativeStartDay: "2026-09-30",
    startDay: "2023-01-01",
    endDay: "2026-09-29",
    months: 45,
    pageviews: 1_200_000,
    clipped: true,
    overlaps: [],
    alreadyImported: false,
    added: null,
  };
  const preview = (
    overrides: Partial<AnalyticsImportPreview>,
    overlap: "skip" | "add" = "skip"
  ) =>
    render(
      <ImportPreview
        onOverlapChange={() => undefined}
        overlap={overlap}
        preview={{ ...basePreview, ...overrides }}
      />
    );
  const nothing = { startDay: null, endDay: null, months: 0, pageviews: 0 };

  test("the preview states the range, cut-off and estimate", () => {
    const html = preview({});
    expect(html).toContain("About 1,200,000");
    expect(html).toContain("45 months");
    expect(html).toContain("started tracking on Sep 30, 2026");
    expect(html).toContain("an earlier import of this source already has");
    expect(preview({ nativeStartDay: null, clipped: false })).toContain(
      "hasn&#x27;t tracked this domain yet"
    );
    const crawlers = preview({ provider: "cloudflare", kind: "geo" });
    expect(crawlers).toContain("Crawler hits");
    expect(crawlers).not.toContain("Page views");
  });

  test("with nothing left to import, the preview says why", () => {
    const again = preview({ ...nothing, alreadyImported: true });
    expect(again).toContain("Already imported");
    expect(again).not.toContain("Page views");
    expect(preview(nothing)).toContain("Nothing new to import");
  });

  test("days another source has can be skipped or added together", () => {
    const overlapping: Partial<AnalyticsImportPreview> = {
      startDay: "2026-07-01",
      endDay: "2026-07-31",
      months: 1,
      pageviews: 5000,
      overlaps: [
        {
          importId: "imp_1",
          provider: "vercel",
          sourceLabel: "marketing",
          host: "acme.com",
          startDay: "2026-08-01",
          endDay: "2026-09-30",
        },
      ],
      added: {
        startDay: "2026-07-01",
        endDay: "2026-09-30",
        months: 3,
        pageviews: 21_000,
        clipped: false,
      },
    };
    const skip = preview(overlapping);
    expect(skip).toContain(
      "acme.com already has Aug 1, 2026 – Sep 30, 2026 from Vercel Web Analytics (marketing)."
    );
    expect(skip).toMatch(/aria-pressed="true"[^>]*>Skip those days</);
    expect(skip).toContain("About 5,000");
    const add = preview(overlapping, "add");
    expect(add).toMatch(/aria-pressed="true"[^>]*>Add together</);
    expect(add).toContain("About 21,000");
    // Fully covered: adding remains possible.
    const covered = preview({ ...overlapping, ...nothing });
    expect(covered).toContain("Every day is already imported");
    expect(covered).toContain("Add together");
  });

  test("the export field takes a ZIP and shows what the server found wrong with it", async () => {
    const field = (file: File | null, serverError?: string) =>
      render(
        <ImportZipField
          disabled={false}
          file={file}
          onChange={() => undefined}
          serverError={
            serverError ? { text: serverError, count: 1 } : undefined
          }
        />
      );
    expect(field(null)).toContain("Drop your Plausible export here");
    const file = new File([new Uint8Array(3400)], "plausible-export.zip", {
      type: "application/zip",
    });
    expect(field(file)).toContain("ZIP · 3.3 kB");
    expect(field(file)).toContain("Remove plausible-export.zip");
    const invalid = field(file, "README.txt: not a file");
    expect(invalid).toContain('aria-invalid="true"');
    expect(invalid).toContain("README.txt: not a file");

    // Only errors about the export itself go under the field.
    const { ORPCError } = await import("@orpc/client");
    const { importFileErrorMessage } =
      await import("../src/utils/analytics-imports");
    expect(
      importFileErrorMessage(
        new ORPCError("BAD_REQUEST", {
          message: "README.txt: not a file",
          data: { field: "file" },
        })
      )
    ).toBe("README.txt: not a file");
    expect(
      importFileErrorMessage(
        new ORPCError("TOO_MANY_REQUESTS", { message: "Too many" })
      )
    ).toBeNull();
    expect(importFileErrorMessage(new Error("Upload failed"))).toBeNull();
  });

  test("the background indicator sums active imports and hides when none run", () => {
    const pill = (imports: AnalyticsImportSummary[]) =>
      render(<ImportActivityPill imports={imports} onOpen={() => undefined} />);
    expect(
      pill([
        { ...running, chunksDone: 8, chunksTotal: 10 },
        { ...queued, chunksTotal: 10 },
        { ...running, id: "imp_done", status: "completed" },
      ])
    ).toContain("Importing 2 sites · 40%");
    expect(pill([{ ...running, status: "completed" }])).toBe("");
  });

  test("a finished import refreshes analytics and is announced once", async () => {
    const seen = new Map();
    expect(finishedSinceLastSeen(seen, [running, queued])).toEqual([]);
    // Imports first seen finished are old news.
    const old = { ...running, id: "imp_old", status: "completed" as const };
    expect(finishedSinceLastSeen(seen, [old])).toEqual([]);
    const done = { ...running, status: "completed" as const };
    const failed = { ...queued, status: "failed" as const };
    const finished = finishedSinceLastSeen(seen, [done, failed]);
    expect(finished.map((item) => item.id)).toEqual(["imp_1", "imp_q"]);
    expect(finishedSinceLastSeen(seen, [done, failed])).toEqual([]);

    const queryClient = new QueryClient();
    const invalidated: unknown[] = [];
    queryClient.invalidateQueries = (async (filters?: {
      queryKey?: unknown;
    }) => {
      invalidated.push(filters?.queryKey);
    }) as QueryClient["invalidateQueries"];
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        stored.set(key, value);
      },
    };
    const notified: string[] = [];
    const notify = (item: AnalyticsImportSummary) => {
      notified.push(`${item.id}:${item.status}`);
    };
    await settleFinishedImports(finished, { queryClient, notify, storage });
    expect(notified).toEqual(["imp_1:completed", "imp_q:failed"]);
    expect(invalidated).toEqual([
      dashboardOrpc.geo.key(),
      dashboardOrpc.analyticsImports.list.key(),
    ]);
    // Another tab sees the same change: no second toast.
    await settleFinishedImports(finished, { queryClient, notify, storage });
    expect(notified).toHaveLength(2);
  });
}
