import assert from "node:assert/strict";
import { test } from "node:test";

import { cleanupRailwaySandbox } from "./utils/cleanup.mjs";

const ledger = {
  projectId: "00000000-0000-4000-8000-000000000001",
  environmentId: "00000000-0000-4000-8000-000000000002",
  sandboxId: "00000000-0000-4000-8000-000000000003",
  projectName: "notra-sites-e2e-synthetic",
};
const project = {
  id: ledger.projectId,
  name: ledger.projectName,
  deletedAt: null,
  environments: { edges: [{ node: { id: ledger.environmentId } }] },
};

test("cleanup rejects malformed ledgers and production names before any API call", async () => {
  let calls = 0;
  const run = () => {
    calls += 1;
    throw new Error("Unexpected call");
  };
  for (const value of [
    null,
    {},
    { ...ledger, projectName: "notra-prod" },
    { ...ledger, sandboxId: "--all" },
  ]) {
    await assert.rejects(cleanupRailwaySandbox(value, run));
  }
  assert.equal(calls, 0);
});

test("cleanup rejects mismatching project names and environments without deleting", async () => {
  for (const value of [
    { ...project, name: "notra-prod" },
    { ...project, deletedAt: "2026-01-01" },
    { ...project, environments: { edges: [] } },
  ]) {
    const commands = [];
    await assert.rejects(
      cleanupRailwaySandbox(ledger, async (args) => {
        commands.push(args);
        return JSON.stringify([value]);
      })
    );
    assert.equal(commands.length, 1);
  }
});

test("cleanup deletes only the recorded sandbox with explicit project and environment", async () => {
  const commands = [];
  let lists = 0;
  const result = await cleanupRailwaySandbox(ledger, async (args) => {
    commands.push(args);
    if (args[0] === "list") {
      return JSON.stringify([project]);
    }
    if (args[1] === "list") {
      return JSON.stringify(
        ++lists === 1
          ? [{ id: ledger.sandboxId }, { id: "foreign" }]
          : [{ id: ledger.sandboxId, status: "DESTROYED" }, { id: "foreign" }]
      );
    }
    return "";
  });
  assert.equal(result.sandboxAbsent, true);
  for (const args of commands.filter((entry) => entry[1] === "list")) {
    assert.ok(args.includes("--all"), args.join(" "));
  }
  assert.deepEqual(commands[2], [
    "sandbox",
    "destroy",
    "--id",
    ledger.sandboxId,
    "-p",
    ledger.projectId,
    "-e",
    ledger.environmentId,
  ]);
});

test("cleanup is idempotent when the recorded sandbox is already absent", async () => {
  const commands = [];
  await cleanupRailwaySandbox(ledger, async (args) => {
    commands.push(args);
    return JSON.stringify(args[0] === "list" ? [project] : [{ id: "foreign" }]);
  });
  assert.equal(
    commands.some((args) => args[1] === "destroy"),
    false
  );
});

test("cleanup fails when absence cannot be verified", async () => {
  await assert.rejects(
    cleanupRailwaySandbox(ledger, async (args) =>
      JSON.stringify(
        args[0] === "list" ? [project] : [{ id: ledger.sandboxId }]
      )
    )
  );
});

test("cleanup refuses a listing that may be truncated", async () => {
  const commands = [];
  await assert.rejects(
    cleanupRailwaySandbox(ledger, async (args) => {
      commands.push(args);
      return JSON.stringify(
        args[0] === "list"
          ? [project]
          : Array.from({ length: 100 }, (_, index) => ({
              id: `other-${index}`,
            }))
      );
    }),
    /Cannot verify Railway sandbox ownership/
  );
  assert.equal(
    commands.some((args) => args[1] === "destroy"),
    false
  );
});
