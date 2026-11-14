import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";

import { geoCompetitors } from "@notra/db/schema";
import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import {
  database,
  initializeDatabase,
  resetDatabase,
  seedProject,
  settingsFor,
  testDb,
} from "./utils/database";
import "./utils/infrastructure";

const { upsertGeoCompetitor } = await import("../src/geo/programs");

const PROJECT_ID = "project-competitors";
const scope = { organizationId: "org-test", projectId: PROJECT_ID };

beforeAll(initializeDatabase);
beforeEach(async () => {
  await resetDatabase();
  await seedProject(PROJECT_ID);
});
afterAll(async () => {
  await database.postgres.close();
});

const storedCompetitors = () =>
  testDb
    .select({ name: geoCompetitors.name, domain: geoCompetitors.domain })
    .from(geoCompetitors)
    .where(eq(geoCompetitors.projectId, PROJECT_ID))
    .orderBy(asc(geoCompetitors.createdAt));

const storedRows = () =>
  testDb
    .select({ id: geoCompetitors.id, createdAt: geoCompetitors.createdAt })
    .from(geoCompetitors)
    .where(eq(geoCompetitors.projectId, PROJECT_ID));

const upsert = (input: Parameters<typeof upsertGeoCompetitor>[1]) =>
  Effect.runPromise(upsertGeoCompetitor(scope, input));

test("renaming a competitor to a different case keeps one row", async () => {
  await upsert({ name: "peec ai", domain: "peec.ai" });
  const before = await storedRows();

  const response = await upsert({
    name: "Peec AI",
    previousName: "peec ai",
    domain: "peec.ai",
  });

  expect(response.competitors.map((row) => row.name)).toEqual(["Peec AI"]);
  expect(await storedCompetitors()).toEqual([
    { name: "Peec AI", domain: "peec.ai" },
  ]);
  expect(await storedRows()).toEqual(before);
  expect((await settingsFor(PROJECT_ID))?.competitors).toEqual(["Peec AI"]);
});

test("upserting a different case without previousName also renames", async () => {
  await upsert({ name: "bydefault", domain: "bydefault.so" });
  const before = await storedRows();

  await upsert({ name: "ByDefault", domain: "bydefault.so" });

  expect(await storedCompetitors()).toEqual([
    { name: "ByDefault", domain: "bydefault.so" },
  ]);
  expect(await storedRows()).toEqual(before);
});

test("rows that differ only in case collapse into one", async () => {
  await upsert({ name: "Jam", domain: "spreadjam.com" });
  await testDb.insert(geoCompetitors).values({
    id: "duplicate-jam",
    organizationId: scope.organizationId,
    projectId: PROJECT_ID,
    name: "jam",
    domain: "spreadjam.com",
  });

  await upsert({ name: "Jam", domain: "spreadjam.com" });

  expect(await storedCompetitors()).toEqual([
    { name: "Jam", domain: "spreadjam.com" },
  ]);
});

test("renaming to a new name replaces the old competitor", async () => {
  await upsert({ name: "Scrunch AI", domain: "scrunch.com" });

  await upsert({
    name: "Scrunch",
    previousName: "Scrunch AI",
    domain: "scrunch.com",
  });

  expect(await storedCompetitors()).toEqual([
    { name: "Scrunch", domain: "scrunch.com" },
  ]);
});
