import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("a poll that lands mid-save keeps the switched automation until it is saved", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--eval",
      String.raw`
        import assert from "node:assert/strict";
        import { mock } from "bun:test";
        import { createElement } from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
        import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";

        let finishSave;
        mock.module("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));
        mock.module("@/lib/orpc/query", () => ({
          dashboardOrpc: { autopilot: {
            key: () => ["autopilot"],
            get: {
              key: () => ["autopilot", "get"],
              queryOptions: ({ input, ...options }) => ({
                ...options, queryKey: ["autopilot", "get", input], queryFn: async () => stale,
              }),
            },
            sync: { key: () => ["autopilot", "sync"], call: async () => {} },
            setJob: {
              key: () => ["autopilot", "setJob"],
              call: () => new Promise((resolve) => { finishSave = resolve; }),
            },
          } },
        }));
        const { useAutopilotActions, useAutopilotOverview, useSavingAutopilotJobs } =
          await import("@/lib/hooks/use-autopilot");

        const kind = AUTOPILOT_AUTOMATION_KINDS[0];
        const stale = { available: false, canManage: false, settings: { jobs: { [kind]: false } }, runs: [], findings: [] };
        const client = new QueryClient();
        client.setQueryData(["autopilot", "get", { organizationId: "org" }], stale);
        const render = (hook) => {
          let value;
          function Probe() { value = hook(); return null; }
          renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Probe)));
          return value;
        };
        const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

        render(() => useAutopilotActions("org")).setJob.mutate({ kind, enabled: true });
        await tick();
        // The overview poll returns before the save commits.
        client.setQueryData(["autopilot", "get", { organizationId: "org" }], stale);
        assert.equal(render(() => useAutopilotOverview("org")).data.settings.jobs[kind], true);
        assert.deepEqual(render(() => useSavingAutopilotJobs("org")), [{ kind, enabled: true }]);

        finishSave({});
        await tick();
        assert.deepEqual(render(() => useSavingAutopilotJobs("org")), []);
        // Saved: the cache holds the switch until the refetch replaces it.
        assert.equal(render(() => useAutopilotOverview("org")).data.settings.jobs[kind], true);
        client.clear();
      `,
    ],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), timeout: 15_000 }
  );
  expect(
    result.status,
    result.stdout.toString() + result.stderr.toString()
  ).toBe(0);
}, 20_000);
