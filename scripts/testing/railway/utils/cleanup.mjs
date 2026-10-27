import {
  SANDBOX_LIST_LIMIT,
  TEST_PROJECT_PATTERN,
  UUID_PATTERN,
} from "../constants/cleanup.mjs";

export async function cleanupRailwaySandbox(ledger, run) {
  if (
    !ledger ||
    !UUID_PATTERN.test(ledger.projectId) ||
    !UUID_PATTERN.test(ledger.environmentId) ||
    !UUID_PATTERN.test(ledger.sandboxId) ||
    typeof ledger.projectName !== "string" ||
    !TEST_PROJECT_PATTERN.test(ledger.projectName)
  ) {
    throw new Error(
      "Refusing cleanup without an owned Sites E2E resource ledger"
    );
  }
  const projects = JSON.parse(await run(["list", "--json"]));
  const project = projects.find((entry) => entry.id === ledger.projectId);
  if (!project || project.name !== ledger.projectName || project.deletedAt) {
    throw new Error("Refusing cleanup outside the exact active test project");
  }
  if (
    !project.environments?.edges?.some(
      ({ node }) => node.id === ledger.environmentId
    )
  ) {
    throw new Error("Refusing cleanup outside the recorded test environment");
  }
  const context = ["-p", ledger.projectId, "-e", ledger.environmentId];
  const isLive = (entry) =>
    entry.id === ledger.sandboxId && entry.status !== "DESTROYED";
  const before = JSON.parse(
    await run(["sandbox", "list", ...context, "--all", "--json"])
  );
  if (!Array.isArray(before) || before.length >= SANDBOX_LIST_LIMIT) {
    throw new Error("Cannot verify Railway sandbox ownership");
  }
  if (before.some(isLive)) {
    await run(["sandbox", "destroy", "--id", ledger.sandboxId, ...context]);
  }
  const after = JSON.parse(
    await run(["sandbox", "list", ...context, "--all", "--json"])
  );
  if (
    !Array.isArray(after) ||
    after.length >= SANDBOX_LIST_LIMIT ||
    after.some(isLive)
  ) {
    throw new Error("Railway still lists the owned sandbox after cleanup");
  }
  return { sandboxAbsent: true, otherSandboxesUntouched: true };
}
