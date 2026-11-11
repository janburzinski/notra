import { beforeEach, expect, mock, test } from "bun:test";

import { FatalError } from "workflow";

import type * as Steps from "../src/workflows/steps/analytics-import-steps";

const turn = mock<typeof Steps.analyticsImportTurnStep>();
const plan = mock<typeof Steps.planAnalyticsImportStep>();
const runChunk = mock<typeof Steps.runAnalyticsImportChunkStep>();
const fail = mock<typeof Steps.failAnalyticsImportStep>();
const finalize = mock<typeof Steps.finalizeAnalyticsImportStep>();
const report = mock<typeof Steps.reportAnalyticsImportFailureStep>();
const sleeps: string[] = [];
mock.module("workflow", () => ({
  FatalError,
  sleep: async (duration: string) => {
    sleeps.push(duration);
  },
}));
mock.module("../src/workflows/steps/analytics-import-steps", () => ({
  analyticsImportTurnStep: turn,
  planAnalyticsImportStep: plan,
  runAnalyticsImportChunkStep: runChunk,
  failAnalyticsImportStep: fail,
  finalizeAnalyticsImportStep: finalize,
  reportAnalyticsImportFailureStep: report,
  deleteAnalyticsImportDataStep: mock(),
}));

const { analyticsImportWorkflow } =
  await import("../src/workflows/analytics-import");

beforeEach(() => {
  for (const step of [turn, plan, runChunk, fail, finalize, report]) {
    step.mockReset();
  }
  sleeps.length = 0;
  turn.mockResolvedValue({ status: "ready" });
  plan.mockResolvedValue({ chunks: ["2026-10-01", "2026-09-01"] });
  fail.mockResolvedValue(undefined);
  finalize.mockResolvedValue(undefined);
});

test.each([
  ["an error that outlasts a step's retries", "database unavailable", true],
  ["a failed chunk", "bad token", false],
])("%s fails the import once", async (_name, error, thrown) => {
  runChunk.mockResolvedValueOnce({ status: "done" });
  if (thrown) {
    runChunk.mockRejectedValueOnce(new Error(error));
  } else {
    runChunk.mockResolvedValueOnce({ status: "failed", error });
  }
  await expect(
    analyticsImportWorkflow({ importId: "imp_1" })
  ).rejects.toBeInstanceOf(FatalError);
  expect(fail.mock.calls).toEqual([["imp_1", error]]);
  expect(report.mock.calls).toEqual([["imp_1", error]]);
  expect(finalize).not.toHaveBeenCalled();
});

test("a failed cleanup still alerts once with both errors", async () => {
  runChunk.mockResolvedValueOnce({ status: "failed", error: "job timed out" });
  fail.mockRejectedValueOnce(new Error("delete queue full"));
  await expect(
    analyticsImportWorkflow({ importId: "imp_1" })
  ).rejects.toBeInstanceOf(FatalError);
  expect(fail).toHaveBeenCalledTimes(1);
  expect(report.mock.calls).toEqual([
    ["imp_1", "job timed out; cleanup failed: delete queue full"],
  ]);
});

test("a chunk of a deleted import cancels the run without failing it", async () => {
  runChunk.mockResolvedValueOnce({ status: "cancelled" });
  expect(await analyticsImportWorkflow({ importId: "imp_1" })).toEqual({
    status: "cancelled",
  });
  expect(runChunk).toHaveBeenCalledTimes(1);
  expect(fail).not.toHaveBeenCalled();
  expect(report).not.toHaveBeenCalled();
  expect(finalize).not.toHaveBeenCalled();
});

test("an import waits durably for the account's earlier import, then completes", async () => {
  turn
    .mockResolvedValueOnce({ status: "waiting", retryAfterSeconds: 300 })
    .mockResolvedValueOnce({ status: "waiting", retryAfterSeconds: 300 });
  runChunk.mockResolvedValue({ status: "done" });
  expect(await analyticsImportWorkflow({ importId: "imp_2" })).toEqual({
    status: "completed",
    chunks: 2,
  });
  expect(sleeps).toEqual(["300s", "300s"]);
  expect(turn).toHaveBeenCalledTimes(3);
  expect(plan.mock.invocationCallOrder[0]).toBeGreaterThan(
    turn.mock.invocationCallOrder[2] ?? Number.POSITIVE_INFINITY
  );
  expect(fail).not.toHaveBeenCalled();
});
