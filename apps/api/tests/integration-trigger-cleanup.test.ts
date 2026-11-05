import { expect, test } from "bun:test";

import type { DbClient } from "../src/types/db";
import { getTriggersForIntegration } from "../src/utils/triggers";

test("integration cleanup finds schedules that target the integration through Linear", async () => {
  const rows = [
    { id: "github", targets: { repositoryIds: ["int-a"] } },
    {
      id: "linear-only",
      targets: { repositoryIds: [], linearIntegrationIds: ["int-a"] },
    },
    { id: "legacy-linear", targets: { repositoryIds: ["linear:int-a"] } },
    {
      id: "other",
      targets: { repositoryIds: ["int-b"], linearIntegrationIds: ["int-c"] },
    },
    { id: "malformed", targets: null },
  ];
  const db = {
    query: { contentTriggers: { findMany: async () => rows } },
  } as unknown as DbClient;

  const affected = await getTriggersForIntegration(db, "org-a", "int-a");

  expect(affected.map((trigger) => trigger.id)).toEqual([
    "github",
    "linear-only",
    "legacy-linear",
  ]);
});
