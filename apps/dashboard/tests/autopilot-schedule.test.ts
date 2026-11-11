import { expect, mock, setSystemTime, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NOTRA_SCHEDULE_TEST !== "1") {
  test("feedback failures do not block daily Autopilot runs", () => {
    const child = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: { PATH: process.env.PATH, NOTRA_SCHEDULE_TEST: "1" },
        timeout: 30000,
      }
    );
    expect(child.status, child.stderr.toString()).toBe(0);
  });
} else {
  const start = mock(async () => ({ alreadyRunning: false }));
  const attempts: { total: number; latest: Date | null } = {
    total: 0,
    latest: null,
  };
  mock.module("@notra/db/drizzle", () => ({
    db: {
      select: () => ({
        from: () => ({ where: async () => [attempts] }),
      }),
      query: {
        autopilotSettings: {
          findMany: async () => [{ organizationId: "org-a" }],
        },
      },
    },
  }));
  mock.module("@/lib/autopilot/flag", () => ({
    isAutopilotEnabledForOrganization: async () => true,
  }));
  mock.module("@/lib/autopilot/findings", () => ({
    syncOfferReactionFeedback: async () => {
      throw new Error("Old repository disconnected");
    },
  }));
  mock.module("@/lib/autopilot/log", () => ({
    purgeExpiredAutopilotTraceDetails: async () => undefined,
  }));
  mock.module("@/utils/autopilot-schedule", () => ({
    isAutopilotDue: () => true,
    autopilotLocalDayStart: () => new Date(0),
  }));
  mock.module("@/lib/autopilot/start", () => ({ startAutopilot: start }));
  const publish = mock(async () => ({
    published: 0,
    waiting: 0,
    cancelled: 0,
  }));
  mock.module("@/lib/autopilot/publish", () => ({
    publishDueFindings: publish,
  }));
  const { runDueAutopilots } = await import("../src/lib/autopilot/schedule");

  test("reports failed feedback while starting a due run", async () => {
    setSystemTime(new Date("2026-11-10T10:01:00Z"));
    try {
      expect(await runDueAutopilots()).toEqual({
        checked: 1,
        started: 1,
        failed: 1,
      });
    } finally {
      setSystemTime();
    }
    expect(start).toHaveBeenCalledWith("org-a", "cron");
    expect(publish).toHaveBeenCalledWith(
      "org-a",
      { posts: "ask", updates: "ask", fixes: "ask" },
      expect.any(Date),
      { siteId: undefined, repositoryBranch: undefined }
    );
  });

  test("a failed publish sweep is counted and still starts the daily run", async () => {
    start.mockClear();
    attempts.total = 0;
    attempts.latest = null;
    publish.mockImplementationOnce(async () => {
      throw new Error("GitHub is down");
    });
    setSystemTime(new Date("2026-11-10T10:31:00Z"));
    try {
      expect(await runDueAutopilots()).toEqual({
        checked: 1,
        started: 1,
        failed: 1,
      });
    } finally {
      setSystemTime();
    }
  });

  test("backs off after a failed attempt today and stops at the cap", async () => {
    start.mockClear();
    attempts.total = 1;
    attempts.latest = new Date();
    expect((await runDueAutopilots()).started).toBe(0);
    attempts.latest = new Date(Date.now() - 31 * 60 * 1000);
    expect((await runDueAutopilots()).started).toBe(1);
    attempts.total = 3;
    attempts.latest = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect((await runDueAutopilots()).started).toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
  });

  test("backs off after a failed attempt today and stops at the cap", async () => {
    start.mockClear();
    attempts.total = 1;
    attempts.latest = new Date();
    expect((await runDueAutopilots()).started).toBe(0);
    attempts.latest = new Date(Date.now() - 31 * 60 * 1000);
    expect((await runDueAutopilots()).started).toBe(1);
    attempts.total = 3;
    attempts.latest = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect((await runDueAutopilots()).started).toBe(0);
    expect(start).toHaveBeenCalledTimes(1);
  });
}
